'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faRotateLeft, faSpinner, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { faCircleCheck, faClock } from '@fortawesome/free-regular-svg-icons';
import { api } from '../../../lib/api';
import { useToast } from '../../../lib/toast';
import { apiErrorMessage } from '../../../lib/api-errors';
import { formatHours, toDateKey } from '../../../lib/format';
import { buildRateResolver, type RateResolver } from '../../../lib/rates';
import type { PeriodApproval, Project, Timesheet, WorkerContract } from '../../../lib/types';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { ReviewModal } from '../../../components/approvals/ReviewModal';

const RECENT_LIMIT = 5; // จำนวนแถวใน Recently Approved (เท่า prototype)

function hoursOf(ts: Timesheet) {
  return ts.entries.reduce(
    (acc, e) => ({ st: acc.st + e.st, ot1: acc.ot1 + e.ot1, ot2: acc.ot2 + e.ot2 }),
    { st: 0, ot1: 0, ot2: 0 },
  );
}

export default function ApprovalsPage() {
  const toast = useToast();

  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [periods, setPeriods] = useState<PeriodApproval[]>([]);
  const [resolveRate, setResolveRate] = useState<RateResolver | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');

  const [projectFilter, setProjectFilter] = useState('ALL');
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  /** โหลดใหม่เฉพาะข้อมูลที่เปลี่ยนหลังอนุมัติ/ปฏิเสธ */
  const refresh = useCallback(async () => {
    const [ts, pa] = await Promise.all([
      api.get<Timesheet[]>('/timesheets'),
      api.get<PeriodApproval[]>('/payroll/period-approvals'),
    ]);
    setTimesheets(ts.data);
    setPeriods(pa.data);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [, p] = await Promise.all([refresh(), api.get<Project[]>('/projects')]);
      setProjects(p.data);
      // อัตราค่าจ้างใช้แค่แสดง Est. Cost — โหลดไม่ได้ก็ยังอนุมัติได้ตามปกติ แค่ซ่อนคอลัมน์ค่าจ้าง
      try {
        const wc = await api.get<WorkerContract[]>('/worker-contracts');
        setResolveRate(() => buildRateResolver(wc.data));
      } catch {
        setResolveRate(null);
      }
      setLoadState('ready');
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not load timesheets.'));
      setLoadState('error');
    }
  }, [refresh]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // ─── ข้อมูลที่แสดง ───
  const projectOptions = useMemo(
    () => [
      { value: 'ALL', label: 'All Projects' },
      ...projects.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` })),
    ],
    [projects],
  );

  /** คิวรออนุมัติ — ใบเก่าสุดอยู่บน เพื่อให้ตรวจตามลำดับที่ส่งเข้ามา */
  const pending = useMemo(
    () =>
      timesheets
        .filter((ts) => ts.status === 'PENDING' && (projectFilter === 'ALL' || ts.projectId === projectFilter))
        .sort((a, b) => toDateKey(a.date).localeCompare(toDateKey(b.date)) || a.createdAt.localeCompare(b.createdAt)),
    [timesheets, projectFilter],
  );

  const recentlyApproved = useMemo(
    () =>
      timesheets
        .filter((ts) => ts.status === 'APPROVED')
        .sort((a, b) => toDateKey(b.date).localeCompare(toDateKey(a.date)))
        .slice(0, RECENT_LIMIT),
    [timesheets],
  );

  /** รอบที่ผู้บริหาร sign-off แล้วซึ่งครอบคลุมวันนั้น (ถ้ามี) */
  function signedOffPeriodFor(dateKey: string) {
    return periods.find(
      (p) => p.status === 'APPROVED' && toDateKey(p.periodStart) <= dateKey && toDateKey(p.periodEnd) >= dateKey,
    );
  }

  const reviewing = reviewId ? timesheets.find((ts) => ts.id === reviewId) ?? null : null;

  // ─── อนุมัติ / ปฏิเสธ ───
  async function act(kind: 'approve' | 'reject', reason?: string) {
    if (!reviewing) return;
    setBusy(kind);
    try {
      if (kind === 'approve') {
        await api.patch(`/timesheets/${reviewing.id}/approve`);
        toast('Timesheet approved.');
      } else {
        await api.patch(`/timesheets/${reviewing.id}/reject`, reason ? { reason } : {});
        toast('Timesheet rejected and returned to foreman.');
      }
      setReviewId(null);
    } catch (err) {
      // เช่น PM อีกคนดำเนินการไปก่อนแล้ว → ปิดหน้าต่างและโหลดสถานะล่าสุด
      toast(`${kind === 'approve' ? 'Approve' : 'Reject'} failed: ${apiErrorMessage(err)}`, true);
      setReviewId(null);
    } finally {
      setBusy(null);
      try {
        await refresh();
      } catch {
        /* รายการเดิมยังแสดงอยู่ ผู้ใช้กด F5 ได้ */
      }
    }
  }

  // ─── แสดงผล ───
  if (loadState === 'loading') {
    return (
      <section className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 py-16 text-center text-slate-400">
          <FontAwesomeIcon icon={faSpinner} spin className="text-2xl mb-3" />
          <p>Loading timesheets...</p>
        </div>
      </section>
    );
  }

  if (loadState === 'error') {
    return (
      <section className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-red-200 py-12 px-6 text-center">
          <FontAwesomeIcon icon={faTriangleExclamation} className="text-3xl text-danger mb-3" />
          <p className="font-medium text-slate-800">{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setLoadState('loading');
              void loadAll();
            }}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-blue-800 transition-colors"
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-6xl mx-auto">
      {/* ─── Pending Approvals ─── */}
      <div className="mb-6 flex flex-wrap justify-between items-end gap-4">
        <div>
          <h3 className="font-semibold text-slate-800 text-lg mb-1">
            Pending Approvals{' '}
            <span className="text-sm font-normal text-slate-400">({pending.length})</span>
          </h3>
          <p className="text-sm text-slate-500">
            Review field hours against budget and client Service Receipts before authorizing payroll.
          </p>
        </div>
        <div className="w-full sm:w-72">
          <SearchableSelect
            instanceId="pm-project-filter"
            ariaLabel="Filter by project"
            options={projectOptions}
            value={projectFilter}
            onChange={(v) => setProjectFilter(v || 'ALL')}
            compact
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        {pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <FontAwesomeIcon icon={faCircleCheck} className="text-4xl mb-3 text-slate-300" />
            <p>
              All caught up! No pending timesheets
              {projectFilter !== 'ALL' ? ' for this project' : ''}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[720px]">
              <thead className="text-xs text-slate-600 bg-slate-50 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Submission Details</th>
                  <th className="px-6 py-4">Submitted By</th>
                  <th className="px-6 py-4 text-center">
                    Total Hours
                    <br />
                    <span className="text-[10px] text-slate-400 font-normal font-mono">(ST / OT1 / OT2)</span>
                  </th>
                  <th className="px-6 py-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pending.map((ts) => {
                  const h = hoursOf(ts);
                  return (
                    <tr key={ts.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800">
                          {toDateKey(ts.date)}
                          <span className="text-xs font-mono text-slate-400 ml-2" title={ts.id}>
                            {ts.id.slice(0, 8)}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {ts.project.code}
                          {ts.jobCode ? ` • ${ts.jobCode}` : ''}
                        </div>
                        {ts.returnedBy && (
                          <div className="text-xs text-amber-600 mt-1">
                            <FontAwesomeIcon icon={faRotateLeft} className="mr-1" />
                            Returned by {ts.returnedBy.name} (Top Management)
                            {ts.returnReason ? `: ${ts.returnReason}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{ts.foreman.name}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-medium">{formatHours(h.st + h.ot1 + h.ot2)}</span>
                        <div className="text-[10px] text-slate-400 mt-1 font-mono">
                          {formatHours(h.st)} / {formatHours(h.ot1)} / {formatHours(h.ot2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => setReviewId(ts.id)}
                          className="text-primary hover:text-blue-800 font-medium text-sm px-3 py-1.5 border border-primary/20 rounded hover:bg-blue-50 transition-colors"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Recently Approved ─── */}
      <h3 className="font-semibold text-slate-700 mb-3 ml-1">Recently Approved (PM)</h3>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[720px]">
            <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Project / Job Code</th>
                <th className="px-6 py-3">Foreman</th>
                <th className="px-6 py-3 text-center">Total Hours</th>
                <th className="px-6 py-3">Top Management</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentlyApproved.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    Nothing approved yet.
                  </td>
                </tr>
              )}
              {recentlyApproved.map((ts) => {
                const h = hoursOf(ts);
                const period = signedOffPeriodFor(toDateKey(ts.date));
                return (
                  <tr key={ts.id}>
                    <td className="px-6 py-3 font-medium">
                      {toDateKey(ts.date)}
                      <span className="text-xs text-slate-400 block font-mono font-normal" title={ts.id}>
                        {ts.id.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      {ts.project.code}
                      <br />
                      {ts.jobCode ? (
                        <span className="text-xs text-slate-500">{ts.jobCode}</span>
                      ) : (
                        <span className="text-xs text-slate-300">No job code</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-slate-600">{ts.foreman.name}</td>
                    <td className="px-6 py-3 text-center font-medium text-slate-700">
                      {formatHours(h.st + h.ot1 + h.ot2)}
                    </td>
                    <td className="px-6 py-3">
                      {period ? (
                        <>
                          <span className="text-xs text-success font-medium">
                            <FontAwesomeIcon icon={faCheck} className="mr-1" />
                            Signed off
                          </span>
                          {period.reviewedBy && (
                            <div className="text-[10px] text-slate-400 mt-0.5">by {period.reviewedBy.name}</div>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-amber-600 font-medium">
                          <FontAwesomeIcon icon={faClock} className="mr-1" />
                          Awaiting Top Management
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {reviewing && (
        <ReviewModal
          timesheet={reviewing}
          resolveRate={resolveRate}
          busy={busy}
          onClose={() => setReviewId(null)}
          onApprove={() => void act('approve')}
          onReject={(reason) => void act('reject', reason)}
        />
      )}
    </section>
  );
}
