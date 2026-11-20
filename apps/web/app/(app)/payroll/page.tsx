'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileCsv,
  faHardHat,
  faMagnifyingGlassDollar,
  faPrint,
  faSpinner,
  faStamp,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { faFolderOpen } from '@fortawesome/free-regular-svg-icons';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { useToast } from '../../../lib/toast';
import { apiErrorMessage } from '../../../lib/api-errors';
import { formatHours, formatMoney, toDateKey, todayKey, toNumber } from '../../../lib/format';
import type { PayrollAggregate, PayrollGateError, PeriodApproval, Timesheet } from '../../../lib/types';

interface Report {
  from: string;
  to: string;
  agg: PayrollAggregate;
  generatedAt: string;
}

const fieldClass =
  'border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/35 bg-white';

/** ค่าเริ่มต้นของช่วงวันที่: รอบล่าสุดที่ผู้บริหารอนุมัติแล้ว (ออกรายงานได้ทันที) ถ้าไม่มี ใช้ต้นเดือนถึงวันนี้ */
function defaultRange(periods: PeriodApproval[]) {
  const latest = periods.find((p) => p.status === 'APPROVED');
  if (latest) return { from: toDateKey(latest.periodStart), to: toDateKey(latest.periodEnd) };
  const today = todayKey();
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

/** ใส่เครื่องหมายคำพูดให้ค่าใน CSV ตามมาตรฐาน */
const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function PayrollPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [periods, setPeriods] = useState<PeriodApproval[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [initState, setInitState] = useState<'loading' | 'ready' | 'error'>('loading');

  const [report, setReport] = useState<Report | null>(null);
  const [gate, setGate] = useState<PayrollGateError | null>(null);
  const [generating, setGenerating] = useState(false);

  const init = useCallback(async () => {
    try {
      const [pa, ts] = await Promise.all([
        api.get<PeriodApproval[]>('/payroll/period-approvals'),
        api.get<Timesheet[]>('/timesheets'),
      ]);
      setPeriods(pa.data);
      setTimesheets(ts.data);
      const r = defaultRange(pa.data);
      setFrom(r.from);
      setTo(r.to);
      setInitState('ready');
    } catch {
      setInitState('error');
    }
  }, []);

  useEffect(() => {
    void init();
  }, [init]);

  const approvedPeriods = periods.filter((p) => p.status === 'APPROVED');

  async function generate(rangeFrom = from, rangeTo = to) {
    if (!rangeFrom || !rangeTo) return toast('Please select both a From and To date.', true);
    if (rangeFrom > rangeTo) return toast('The From date must be before the To date.', true);
    setFrom(rangeFrom);
    setTo(rangeTo);
    setGenerating(true);
    setGate(null);
    try {
      const res = await api.get<PayrollAggregate>('/payroll/report', { params: { from: rangeFrom, to: rangeTo } });
      setReport({ from: rangeFrom, to: rangeTo, agg: res.data, generatedAt: new Date().toLocaleString('en-US') });
    } catch (err) {
      setReport(null);
      // 403 = ช่วงวันที่นี้ยังไม่ผ่าน Period Sign-off → แสดงรอบที่อนุมัติแล้วให้เลือก
      if (axios.isAxiosError(err) && err.response?.status === 403 && 'approvedPeriods' in (err.response.data ?? {})) {
        setGate(err.response.data as PayrollGateError);
      } else {
        toast(`Could not generate report: ${apiErrorMessage(err)}`, true);
      }
    } finally {
      setGenerating(false);
    }
  }

  // ─── ข้อมูลประกอบรายงาน ───
  const signOff = report
    ? periods.find((p) => toDateKey(p.periodStart) === report.from && toDateKey(p.periodEnd) === report.to)
    : undefined;
  const snapshotCost = signOff ? toNumber(signOff.totalCost) : null;
  const totalsChanged = !!report && snapshotCost != null && Math.abs(snapshotCost - report.agg.grandPay) >= 0.01;

  /**
   * โครงการ / Job No. ของแต่ละบรรทัด — รายงานจาก API ไม่มีข้อมูลนี้ จึงจับคู่กับใบที่อนุมัติแล้ว
   * ด้วย วันที่ + คนงาน + ตำแหน่ง + ชั่วโมง (ตรงกับ entry เดียวกันในใบนั้น)
   */
  const projectLookup = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const ts of timesheets) {
      if (ts.status !== 'APPROVED') continue;
      const label = ts.jobCode ? `${ts.project.code} / ${ts.jobCode}` : ts.project.code;
      for (const e of ts.entries) {
        const key = [toDateKey(ts.date), e.workerId, e.tradeId, e.st, e.ot1, e.ot2].join('|');
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(label);
      }
    }
    return map;
  }, [timesheets]);

  const detail = useMemo(() => {
    if (!report) return [];
    const used = new Map<string, number>();
    return report.agg.workerSummaries.map((w) => ({
      ...w,
      items: w.items.map((li) => {
        const key = [toDateKey(li.date), li.workerId, li.tradeId, li.st, li.ot1, li.ot2].join('|');
        const n = used.get(key) ?? 0;
        used.set(key, n + 1);
        return { ...li, project: projectLookup.get(key)?.[n] ?? '—' };
      }),
    }));
  }, [report, projectLookup]);

  function exportCsv() {
    if (!report) return;
    const header = ['Worker', 'Date', 'Project / Job No.', 'Position', 'Rate (THB/hr)', 'ST', 'OT1', 'OT2', 'Cost (THB)'];
    const rows = detail.flatMap((w) =>
      w.items.map((li) => [
        w.workerName,
        toDateKey(li.date),
        li.project,
        li.tradeName,
        li.rate != null ? li.rate.toFixed(2) : 'pending',
        li.st.toFixed(1),
        li.ot1.toFixed(1),
        li.ot2.toFixed(1),
        li.lineCost != null ? li.lineCost.toFixed(2) : 'pending',
      ]),
    );
    // BOM ให้ Excel อ่านชื่อภาษาไทยได้ถูกต้อง
    const csv = '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll_${report.from}_to_${report.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (initState === 'loading') {
    return (
      <section className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 py-16 text-center text-slate-400">
          <FontAwesomeIcon icon={faSpinner} spin className="text-2xl mb-3" />
          <p>Loading...</p>
        </div>
      </section>
    );
  }

  if (initState === 'error') {
    return (
      <section className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-red-200 py-12 px-6 text-center">
          <FontAwesomeIcon icon={faTriangleExclamation} className="text-3xl text-danger mb-3" />
          <p className="font-medium text-slate-800">Could not load payroll data.</p>
          <button
            type="button"
            onClick={() => {
              setInitState('loading');
              void init();
            }}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-blue-800 transition-colors"
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  const agg = report?.agg;
  const hasData = !!agg && agg.workerSummaries.length > 0;

  return (
    <section className="max-w-7xl mx-auto">
      <div className="mb-6 print:hidden">
        <h3 className="font-semibold text-slate-800 text-lg mb-1">Payroll</h3>
        <p className="text-sm text-slate-500">
          Generate payroll reports from approved timesheets. Wage rates come from{' '}
          <Link href="/worker-contracts" className="font-semibold text-primary hover:underline">
            Worker Contracts
          </Link>
          .
        </p>
      </div>

      {/* ─── เลือกช่วงวันที่ ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 print:hidden">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="payroll-from" className="block text-sm font-medium text-slate-700 mb-1">
              From
            </label>
            <input id="payroll-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="payroll-to" className="block text-sm font-medium text-slate-700 mb-1">
              To
            </label>
            <input id="payroll-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className={fieldClass} />
          </div>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={generating}
            className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-70 disabled:cursor-wait"
          >
            <FontAwesomeIcon icon={generating ? faSpinner : faMagnifyingGlassDollar} spin={generating} className="mr-2" />
            Generate Report
          </button>
          {hasData && (
            <>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition-colors"
              >
                <FontAwesomeIcon icon={faPrint} className="mr-2" />
                Print / Save PDF
              </button>
              <button
                type="button"
                onClick={exportCsv}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition-colors"
              >
                <FontAwesomeIcon icon={faFileCsv} className="mr-2 text-success" />
                Export CSV
              </button>
            </>
          )}
        </div>

        {approvedPeriods.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">Signed-off periods:</span>
            {approvedPeriods.map((p) => {
              const pf = toDateKey(p.periodStart);
              const pt = toDateKey(p.periodEnd);
              const active = report?.from === pf && report?.to === pt;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void generate(pf, pt)}
                  className={`px-2.5 py-1 rounded-full border text-xs transition-colors ${
                    active
                      ? 'bg-primary text-white border-primary'
                      : 'border-slate-300 text-slate-600 hover:border-primary hover:text-primary'
                  }`}
                >
                  {pf} to {pt}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── ยังไม่ผ่าน Period Sign-off ─── */}
      {gate && (
        <div className="flex flex-col items-center justify-center py-10 px-6 mb-6 text-center text-amber-700 bg-amber-50 border border-amber-200 rounded-xl print:hidden">
          <FontAwesomeIcon icon={faStamp} className="text-4xl mb-3 text-amber-400" />
          <p className="font-medium">Top Management hasn&apos;t signed off on this exact date range yet.</p>
          <p className="text-sm text-amber-600 mt-1">
            Payroll can only be generated for a period that has been approved under <strong>Period Sign-off</strong>.
          </p>
          <div className="text-sm mt-3">
            {gate.approvedPeriods.length > 0 ? (
              <>
                Approved periods available:
                {gate.approvedPeriods.map((p) => (
                  <button
                    key={`${p.periodStart}-${p.periodEnd}`}
                    type="button"
                    onClick={() => void generate(toDateKey(p.periodStart), toDateKey(p.periodEnd))}
                    className="underline text-primary hover:text-blue-800 mx-1"
                  >
                    {toDateKey(p.periodStart)} to {toDateKey(p.periodEnd)}
                  </button>
                ))}
              </>
            ) : (
              'No periods have been signed off yet — ask Top Management to review one under Period Sign-off.'
            )}
          </div>
        </div>
      )}

      {/* ─── ไม่มีข้อมูล ─── */}
      {report && !hasData && (
        <div className="flex flex-col items-center justify-center py-12 mb-6 text-slate-400 bg-white rounded-xl border border-slate-200 print:hidden">
          <FontAwesomeIcon icon={faFolderOpen} className="text-4xl mb-3 text-slate-300" />
          <p>No approved timesheets found in this period.</p>
        </div>
      )}

      {/* ─── รายงาน (ส่วนที่ถูกพิมพ์) ─── */}
      {report && agg && hasData && (
        <div className="print-report bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 print:shadow-none print:border-0 print:p-0">
          <div className="flex flex-wrap print:flex-nowrap justify-between items-start gap-4 mb-6 pb-4 border-b-2 border-slate-800">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={faHardHat} className="text-2xl text-amber-500" />
              <div>
                <h2 className="text-lg font-bold text-slate-800">Personal Timesheet App — Payroll Report</h2>
                <p className="text-sm text-slate-600 mt-0.5">
                  Period:{' '}
                  <span className="font-medium">
                    {report.from} to {report.to}
                  </span>
                </p>
              </div>
            </div>
            <div className="text-right text-xs text-slate-500 print:shrink-0">
              <div>Generated: {report.generatedAt}</div>
              <div>Prepared by: {user?.name}</div>
              {signOff?.reviewedBy && (
                <div className="text-success mt-0.5">
                  Signed off by {signOff.reviewedBy.name} ·{' '}
                  {new Date(signOff.reviewedAt).toLocaleDateString('en-US')}
                </div>
              )}
            </div>
          </div>

          {agg.grandUnpriced > 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              <FontAwesomeIcon icon={faTriangleExclamation} className="mr-1" />
              {formatHours(agg.grandUnpriced)} hrs have no pay rate and are not included in Total Pay.{' '}
              <Link href="/worker-contracts" className="underline print:no-underline">
                Add the missing rates in Worker Contracts
              </Link>{' '}
              before paying.
            </p>
          )}
          {totalsChanged && (
            <p className="text-xs text-amber-600 mb-4 print:hidden">
              <FontAwesomeIcon icon={faTriangleExclamation} className="mr-1" />
              Total Pay differs from the total Top Management signed off ({formatMoney(snapshotCost)}), usually because pay
              rates were added after sign-off.
            </p>
          )}

          <h4 className="font-semibold text-slate-800 mb-2">Summary</h4>
          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm text-left border border-slate-200 min-w-[640px]">
              <thead className="text-xs text-slate-600 bg-slate-50 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2">Worker</th>
                  <th className="px-4 py-2 text-center">ST</th>
                  <th className="px-4 py-2 text-center">OT1</th>
                  <th className="px-4 py-2 text-center">OT2</th>
                  <th className="px-4 py-2 text-center">Total Hrs</th>
                  <th className="px-4 py-2 text-right">Total Pay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agg.workerSummaries.map((w) => (
                  <tr key={w.workerId}>
                    <td className="px-4 py-2 font-medium text-slate-800">
                      {w.workerName}
                      <div className="text-xs text-slate-400 font-normal">{w.positions}</div>
                    </td>
                    <td className="px-4 py-2 text-center">{formatHours(w.st)}</td>
                    <td className={`px-4 py-2 text-center ${w.ot1 > 0 ? 'text-accent' : 'text-slate-400'}`}>
                      {formatHours(w.ot1)}
                    </td>
                    <td className={`px-4 py-2 text-center ${w.ot2 > 0 ? 'text-danger' : 'text-slate-400'}`}>
                      {formatHours(w.ot2)}
                    </td>
                    <td className="px-4 py-2 text-center font-medium">{formatHours(w.hrs)}</td>
                    <td className="px-4 py-2 text-right font-medium whitespace-nowrap">
                      {formatMoney(w.pay)}
                      {w.unpriced > 0 && (
                        <span className="block text-amber-600 font-normal text-xs">
                          +{formatHours(w.unpriced)} hrs pending rate
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-800">
                <tr>
                  <td className="px-4 py-2">GRAND TOTAL</td>
                  <td className="px-4 py-2 text-center">{formatHours(agg.grandSt)}</td>
                  <td className="px-4 py-2 text-center">{formatHours(agg.grandOt1)}</td>
                  <td className="px-4 py-2 text-center">{formatHours(agg.grandOt2)}</td>
                  <td className="px-4 py-2 text-center">{formatHours(agg.grandHrs)}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {formatMoney(agg.grandPay)}
                    {agg.grandUnpriced > 0 && (
                      <span className="block text-amber-600 font-normal text-xs">
                        +{formatHours(agg.grandUnpriced)} hrs pending rate
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <h4 className="font-semibold text-slate-800 mb-3">Detail by Worker</h4>
          <div className="space-y-6">
            {detail.map((w) => (
              <div key={w.workerId} className="border border-slate-200 rounded-lg overflow-hidden break-inside-avoid">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2">
                  <span className="font-semibold text-slate-800">{w.workerName}</span>
                  <span className="text-sm text-slate-600">
                    Subtotal: <span className="font-semibold">{formatMoney(w.pay)}</span> ({formatHours(w.hrs)} hrs
                    {w.unpriced > 0 ? `, ${formatHours(w.unpriced)} pending rate` : ''})
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left min-w-[720px]">
                    <thead className="text-xs text-slate-500 bg-white uppercase border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-1.5">Date</th>
                        <th className="px-3 py-1.5">Project / Job Code</th>
                        <th className="px-3 py-1.5">Position</th>
                        <th className="px-3 py-1.5 text-right">Rate</th>
                        <th className="px-3 py-1.5 text-center">ST</th>
                        <th className="px-3 py-1.5 text-center">OT1</th>
                        <th className="px-3 py-1.5 text-center">OT2</th>
                        <th className="px-3 py-1.5 text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {w.items.map((li, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5 font-mono text-xs whitespace-nowrap">{toDateKey(li.date)}</td>
                          <td className="px-3 py-1.5 text-xs">{li.project}</td>
                          <td className="px-3 py-1.5">{li.tradeName}</td>
                          <td className="px-3 py-1.5 text-right font-mono whitespace-nowrap">
                            {li.rate != null ? `฿${li.rate.toFixed(2)}/hr` : <span className="text-amber-600">pending</span>}
                          </td>
                          <td className="px-3 py-1.5 text-center">{li.st > 0 ? formatHours(li.st) : '-'}</td>
                          <td className={`px-3 py-1.5 text-center ${li.ot1 > 0 ? 'text-accent' : 'text-slate-400'}`}>
                            {li.ot1 > 0 ? formatHours(li.ot1) : '-'}
                          </td>
                          <td className={`px-3 py-1.5 text-center ${li.ot2 > 0 ? 'text-danger' : 'text-slate-400'}`}>
                            {li.ot2 > 0 ? formatHours(li.ot2) : '-'}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono whitespace-nowrap">
                            {li.lineCost != null ? formatMoney(li.lineCost) : <span className="text-slate-400">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
