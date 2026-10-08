'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { api } from '../../../lib/api';
import { apiErrorMessage } from '../../../lib/api-errors';
import { formatHours, formatMoney, toDateKey, todayKey } from '../../../lib/format';
import { buildRateResolver, calcLineCost, type RateResolver } from '../../../lib/rates';
import type { Timesheet, WorkerContract } from '../../../lib/types';
import { ProjectCostChart, type ProjectCost } from '../../../components/dashboard/ProjectCostChart';
import { HoursDistribution } from '../../../components/dashboard/HoursDistribution';

// ─── ช่วงวันที่ ─────────────────────────────────────────────

type Preset = 'all' | 'thisMonth' | 'lastMonth' | 'last3' | 'thisYear';

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'last3', label: 'Last 3 months' },
  { value: 'thisYear', label: 'This year' },
];

const pad = (n: number) => String(n).padStart(2, '0');
const monthStart = (y: number, m: number) => {
  // m เริ่มที่ 1, รองรับ m <= 0 (ย้อนปี)
  const d = new Date(Date.UTC(y, m - 1, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`;
};
const monthEnd = (y: number, m: number) => {
  const d = new Date(Date.UTC(y, m, 0));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

/** ช่วงวันที่แบบ "YYYY-MM-DD" ตามวันที่ในเครื่องผู้ใช้ (null = ไม่จำกัด) */
function presetRange(p: Preset): { from: string | null; to: string | null } {
  const today = todayKey();
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  switch (p) {
    case 'thisMonth':
      return { from: monthStart(y, m), to: today };
    case 'lastMonth':
      return { from: monthStart(y, m - 1), to: monthEnd(y, m - 1) };
    case 'last3':
      return { from: monthStart(y, m - 2), to: today };
    case 'thisYear':
      return { from: `${y}-01-01`, to: today };
    default:
      return { from: null, to: null };
  }
}

// ─── สรุปยอด ───────────────────────────────────────────────

interface JobRow {
  jobCode: string;
  st: number;
  ot: number;
  cost: number;
  unpricedHours: number;
}

function summarize(timesheets: Timesheet[], resolve: RateResolver | null) {
  let totalCost = 0;
  let otCost = 0;
  let unpricedHours = 0;
  let unpricedOtHours = 0;
  let st = 0;
  let ot1 = 0;
  let ot2 = 0;
  const byProject = new Map<string, ProjectCost>();
  const byJob = new Map<string, JobRow>();

  for (const ts of timesheets) {
    const dateKey = toDateKey(ts.date);
    if (!byProject.has(ts.projectId)) {
      byProject.set(ts.projectId, { key: ts.projectId, code: ts.project.code, name: ts.project.name, cost: 0, hours: 0 });
    }
    const p = byProject.get(ts.projectId)!;
    const jcKey = ts.jobCode || 'Unassigned';
    if (!byJob.has(jcKey)) byJob.set(jcKey, { jobCode: jcKey, st: 0, ot: 0, cost: 0, unpricedHours: 0 });
    const j = byJob.get(jcKey)!;

    for (const e of ts.entries) {
      const hrs = e.st + e.ot1 + e.ot2;
      st += e.st;
      ot1 += e.ot1;
      ot2 += e.ot2;
      p.hours += hrs;
      j.st += e.st;
      j.ot += e.ot1 + e.ot2;

      const rate = resolve ? resolve(e.workerId, e.tradeId, dateKey) : null;
      if (rate == null) {
        unpricedHours += hrs;
        unpricedOtHours += e.ot1 + e.ot2;
        j.unpricedHours += hrs;
        continue;
      }
      const cost = calcLineCost(rate, e.st, e.ot1, e.ot2);
      totalCost += cost;
      // เหมือน prototype: "Overtime Premium Cost" = ค่าจ้างส่วน OT ทั้งก้อน (1.5x และ 2.0x)
      otCost += e.ot1 * rate * 1.5 + e.ot2 * rate * 2.0;
      p.cost += cost;
      j.cost += cost;
    }
  }

  return {
    totalCost,
    otCost,
    unpricedHours,
    unpricedOtHours,
    hours: { st, ot1, ot2 },
    totalHours: st + ot1 + ot2,
    projectCount: byProject.size,
    byProject: [...byProject.values()].sort((a, b) => b.cost - a.cost || b.hours - a.hours),
    byJob: [...byJob.values()].sort((a, b) => b.cost - a.cost || b.st + b.ot - (a.st + a.ot)),
  };
}

export default function DashboardPage() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [resolveRate, setResolveRate] = useState<RateResolver | null>(null);
  const [ratesAvailable, setRatesAvailable] = useState(true);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [preset, setPreset] = useState<Preset>('all');

  const load = useCallback(async () => {
    try {
      const ts = await api.get<Timesheet[]>('/timesheets');
      setTimesheets(ts.data);
      try {
        const wc = await api.get<WorkerContract[]>('/worker-contracts');
        setResolveRate(() => buildRateResolver(wc.data));
        setRatesAvailable(true);
      } catch {
        setResolveRate(null);
        setRatesAvailable(false);
      }
      setLoadState('ready');
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not load dashboard data.'));
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const range = presetRange(preset);
  const data = useMemo(() => {
    const approved = timesheets.filter((ts) => {
      if (ts.status !== 'APPROVED') return false;
      const d = toDateKey(ts.date);
      return (!range.from || d >= range.from) && (!range.to || d <= range.to);
    });
    return summarize(approved, resolveRate);
  }, [timesheets, resolveRate, range.from, range.to]);

  if (loadState === 'loading') {
    return (
      <section className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 py-16 text-center text-slate-400">
          <FontAwesomeIcon icon={faSpinner} spin className="text-2xl mb-3" />
          <p>Loading dashboard...</p>
        </div>
      </section>
    );
  }

  if (loadState === 'error') {
    return (
      <section className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-red-200 py-12 px-6 text-center">
          <FontAwesomeIcon icon={faTriangleExclamation} className="text-3xl text-danger mb-3" />
          <p className="font-medium text-slate-800">{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setLoadState('loading');
              void load();
            }}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-blue-800 transition-colors"
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  const maxJobCost = Math.max(...data.byJob.map((j) => j.cost), 0);
  const rangeText = range.from ? `${range.from} to ${range.to}` : 'All approved timesheets';

  return (
    <section className="max-w-7xl mx-auto">
      {/* ─── หัวข้อ + ตัวกรองช่วงเวลา ─── */}
      <div className="mb-6 flex flex-wrap justify-between items-end gap-4">
        <div>
          <h3 className="font-semibold text-slate-800 text-lg">Executive Overview: Labor Costs</h3>
          <p className="text-sm text-slate-500">
            Aggregated payroll data from PM-approved timesheets · <span className="text-slate-600">{rangeText}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1 bg-white border border-slate-200 rounded-lg p-1" role="group" aria-label="Date range">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPreset(p.value)}
              aria-pressed={preset === p.value}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                preset === p.value ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!ratesAvailable && (
        <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-sm mb-4 border border-amber-200">
          <FontAwesomeIcon icon={faTriangleExclamation} className="mr-1" />
          Pay rates couldn&apos;t be loaded, so costs are shown as ฿0. Hours are still accurate.
        </div>
      )}

      {/* ─── KPI ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-primary">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total Labor Cost (Approved)</p>
          <p className="text-2xl font-bold text-slate-800">{formatMoney(data.totalCost)}</p>
          {data.unpricedHours > 0 && (
            <p className="text-xs text-amber-600 mt-1">
              {formatHours(data.unpricedHours)} approved hrs awaiting a pay rate from Accounting
            </p>
          )}
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-secondary">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total Hours Logged</p>
          <p className="text-2xl font-bold text-slate-800">{formatHours(data.totalHours)}</p>
          <p className="text-xs text-slate-400 mt-1">
            Across {data.projectCount} project{data.projectCount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-accent">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Overtime Premium Cost</p>
          <p className="text-2xl font-bold text-slate-800">{formatMoney(data.otCost)}</p>
          {data.totalCost > 0 && (
            <p className="text-xs text-slate-400 mt-1">
              {Math.round((data.otCost / data.totalCost) * 100)}% of total labor cost
            </p>
          )}
          {data.unpricedOtHours > 0 && (
            <p className="text-xs text-amber-600 mt-1">
              {formatHours(data.unpricedOtHours)} OT hrs not yet priced (no pay rate on file)
            </p>
          )}
        </div>
      </div>

      {/* ─── กราฟ ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
          <h4 className="font-semibold text-slate-700 text-sm mb-4">Cumulative Cost by Project</h4>
          <ProjectCostChart data={data.byProject} />
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h4 className="font-semibold text-slate-700 text-sm mb-4">Hours Distribution</h4>
          <HoursDistribution {...data.hours} />
        </div>
      </div>

      {/* ─── ตาราง Job Code ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h4 className="font-semibold text-slate-700 text-sm">Job Code Analysis (Top Offenders)</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[720px]">
            <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Job Code / Activity</th>
                <th className="px-6 py-3 text-right">Total ST</th>
                <th className="px-6 py-3 text-right text-accent">Total OT (1.5x + 2.0x)</th>
                <th className="px-6 py-3 text-right">Labor Cost</th>
                <th className="px-6 py-3 w-1/4">Share of Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.byJob.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No approved hours in this range.
                  </td>
                </tr>
              )}
              {data.byJob.map((j) => (
                <tr key={j.jobCode}>
                  <td className={`px-6 py-3 font-medium ${j.jobCode === 'Unassigned' ? 'text-slate-400' : 'text-slate-700'}`}>
                    {j.jobCode}
                  </td>
                  <td className="px-6 py-3 text-right text-slate-600 tabular-nums">{formatHours(j.st)}</td>
                  <td
                    className={`px-6 py-3 text-right font-medium tabular-nums ${j.ot > 0 ? 'text-accent' : 'text-slate-400'}`}
                  >
                    {formatHours(j.ot)}
                  </td>
                  <td className="px-6 py-3 text-right font-mono whitespace-nowrap">
                    {formatMoney(j.cost)}
                    {j.unpricedHours > 0 && (
                      <span className="block text-[10px] font-sans text-amber-600">
                        +{formatHours(j.unpricedHours)} hrs pending rate
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full">
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${maxJobCost > 0 ? (j.cost / maxJobCost) * 100 : 0}%`, background: '#1e3a8a' }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 w-10 text-right tabular-nums">
                        {data.totalCost > 0 ? `${Math.round((j.cost / data.totalCost) * 100)}%` : '—'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
