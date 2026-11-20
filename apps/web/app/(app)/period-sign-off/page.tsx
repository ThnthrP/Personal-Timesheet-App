'use client';

import { useCallback, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck,
  faCircleCheck,
  faCircleXmark,
  faHardHat,
  faMagnifyingGlass,
  faPrint,
  faRotateLeft,
  faSpinner,
  faTriangleExclamation,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { faClock, faFolderOpen } from '@fortawesome/free-regular-svg-icons';
import { api } from '../../../lib/api';
import { useToast } from '../../../lib/toast';
import { apiErrorMessage } from '../../../lib/api-errors';
import { formatHours, formatMoney, toDateKey, todayKey, toNumber } from '../../../lib/format';
import type { PayrollAggregate, PeriodApproval, RejectPeriodResult } from '../../../lib/types';
import { Modal } from '../../../components/Modal';

// ─── ช่วงวันที่ของรอบ ───────────────────────────────────────

interface Range {
  from: string; // "YYYY-MM-DD"
  to: string;
  label: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** รอบมาตรฐาน: ครึ่งแรก 1–15 / ครึ่งหลัง 16–สิ้นเดือน (เหมือน prototype) */
function standardRange(month: string, half: '1' | '2'): Range | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [y, m] = month.split('-').map(Number);
  if (half === '1') {
    const from = `${y}-${pad(m)}-01`;
    const to = `${y}-${pad(m)}-15`;
    return { from, to, label: `${from} to ${to} (1st half)` };
  }
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate(); // วันที่ 0 ของเดือนถัดไป = วันสุดท้ายของเดือนนี้
  const from = `${y}-${pad(m)}-16`;
  const to = `${y}-${pad(m)}-${pad(lastDay)}`;
  return { from, to, label: `${from} to ${to} (2nd half)` };
}

interface Loaded {
  range: Range;
  agg: PayrollAggregate;
  generatedAt: string;
}

const fieldClass =
  'border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/35 bg-white';

const periodText = (ps: PeriodApproval[]) =>
  ps.map((p) => ` ${toDateKey(p.periodStart)} to ${toDateKey(p.periodEnd)}`).join(',');

export default function PeriodSignOffPage() {
  const toast = useToast();
  const today = todayKey();

  // ─── ตัวเลือกรอบ ───
  const [periodType, setPeriodType] = useState<'standard' | 'custom'>('standard');
  const [month, setMonth] = useState(today.slice(0, 7));
  const [half, setHalf] = useState<'1' | '2'>(Number(today.slice(8)) <= 15 ? '1' : '2');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // ─── ข้อมูล ───
  const [periods, setPeriods] = useState<PeriodApproval[]>([]);
  const [historyState, setHistoryState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadingPeriod, setLoadingPeriod] = useState(false);

  // ─── การอนุมัติ / ตีกลับ ───
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [acting, setActing] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const res = await api.get<PeriodApproval[]>('/payroll/period-approvals');
      setPeriods(res.data);
      setHistoryState('ready');
    } catch {
      setHistoryState('error');
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  async function loadPeriod(range: Range) {
    if (range.from > range.to) {
      toast('The From date must be before the To date.', true);
      return;
    }
    setLoadingPeriod(true);
    try {
      const res = await api.get<PayrollAggregate>('/payroll/preview', {
        params: { from: range.from, to: range.to },
      });
      setLoaded({ range, agg: res.data, generatedAt: new Date().toLocaleString('en-US') });
    } catch (err) {
      toast(`Could not load period: ${apiErrorMessage(err)}`, true);
    } finally {
      setLoadingPeriod(false);
    }
  }

  function handleLoadClick() {
    if (periodType === 'standard') {
      const range = standardRange(month, half);
      if (!range) return toast('Please choose a month.', true);
      void loadPeriod(range);
    } else {
      if (!customFrom || !customTo) return toast('Please choose both a From and To date.', true);
      void loadPeriod({ from: customFrom, to: customTo, label: `${customFrom} to ${customTo}` });
    }
  }

  /** เปิดรอบจากตารางประวัติ */
  function openHistoryPeriod(p: PeriodApproval) {
    const from = toDateKey(p.periodStart);
    const to = toDateKey(p.periodEnd);
    setPeriodType('custom');
    setCustomFrom(from);
    setCustomTo(to);
    void loadPeriod({ from, to, label: `${from} to ${to}` });
  }

  // ─── สถานะของรอบที่โหลดอยู่ ───
  const record = loaded
    ? periods.find((p) => toDateKey(p.periodStart) === loaded.range.from && toDateKey(p.periodEnd) === loaded.range.to)
    : undefined;

  /** รอบอื่นที่อนุมัติแล้วและมีวันทับกับรอบนี้ — ถ้าอนุมัติทั้งคู่ วันที่ทับกันจะถูกนับเงินสองครั้ง */
  const overlapping = loaded
    ? periods.filter(
        (p) =>
          p.status === 'APPROVED' &&
          p !== record &&
          toDateKey(p.periodStart) <= loaded.range.to &&
          toDateKey(p.periodEnd) >= loaded.range.from,
      )
    : [];

  // ยอดตอนเซ็นเทียบกับยอดปัจจุบัน — ต่างกันได้ถ้าฝ่ายบัญชีเพิ่มสัญญาค่าจ้างหลังเซ็น
  const snapshotCost = record?.status === 'APPROVED' ? toNumber(record.totalCost) : null;
  const totalsChanged = !!loaded && snapshotCost != null && Math.abs(snapshotCost - loaded.agg.grandPay) >= 0.01;

  function handleApproveClick() {
    // อนุมัติซ้ำ หรือทับรอบอื่น → ให้ยืนยันก่อน, กรณีปกติอนุมัติได้ทันทีเหมือน prototype
    if (record?.status === 'APPROVED' || overlapping.length > 0) setDialog('approve');
    else void approve();
  }

  async function approve() {
    if (!loaded) return;
    setActing(true);
    try {
      await api.post('/payroll/period-approvals/sign-off', {
        periodStart: loaded.range.from,
        periodEnd: loaded.range.to,
      });
      toast('Period approved and signed off.');
      setDialog(null);
      await loadHistory();
    } catch (err) {
      toast(`Approve failed: ${apiErrorMessage(err)}`, true);
    } finally {
      setActing(false);
    }
  }

  async function reject() {
    if (!loaded) return;
    setActing(true);
    try {
      const res = await api.post<RejectPeriodResult>('/payroll/period-approvals/reject', {
        periodStart: loaded.range.from,
        periodEnd: loaded.range.to,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      toast(`Period rejected — ${res.data.affectedTimesheetCount} timesheet(s) sent back to PM for review.`);
      setDialog(null);
      setReason('');
      await Promise.all([loadHistory(), loadPeriod(loaded.range)]);
    } catch (err) {
      toast(`Reject failed: ${apiErrorMessage(err)}`, true);
    } finally {
      setActing(false);
    }
  }

  const agg = loaded?.agg;
  const hasData = !!agg && agg.workerSummaries.length > 0;

  const cancelBtn = (
    <button
      type="button"
      onClick={() => setDialog(null)}
      disabled={acting}
      className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
    >
      Cancel
    </button>
  );

  return (
    <section className="max-w-7xl mx-auto">
      <div className="mb-6 print:hidden">
        <h3 className="font-semibold text-slate-800 text-lg mb-1">Period Sign-off</h3>
        <p className="text-sm text-slate-500">
          Review PM-approved hours in bulk — every 15 days, or a custom range — and sign off before Accounting can run
          payroll for that period.
        </p>
      </div>

      {/* ─── เลือกรอบ ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 print:hidden">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="period-type" className="block text-sm font-medium text-slate-700 mb-1">
              Period Type
            </label>
            <select
              id="period-type"
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as 'standard' | 'custom')}
              className={fieldClass}
            >
              <option value="standard">Standard (1st–15th / 16th–End)</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {periodType === 'standard' ? (
            <>
              <div>
                <label htmlFor="period-month" className="block text-sm font-medium text-slate-700 mb-1">
                  Month
                </label>
                <input
                  id="period-month"
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor="period-half" className="block text-sm font-medium text-slate-700 mb-1">
                  Half
                </label>
                <select
                  id="period-half"
                  value={half}
                  onChange={(e) => setHalf(e.target.value as '1' | '2')}
                  className={fieldClass}
                >
                  <option value="1">1st – 15th</option>
                  <option value="2">16th – End of Month</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="period-from" className="block text-sm font-medium text-slate-700 mb-1">
                  From
                </label>
                <input
                  id="period-from"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor="period-to" className="block text-sm font-medium text-slate-700 mb-1">
                  To
                </label>
                <input
                  id="period-to"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className={fieldClass}
                />
              </div>
            </>
          )}

          <button
            type="button"
            onClick={handleLoadClick}
            disabled={loadingPeriod}
            className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-70 disabled:cursor-wait"
          >
            <FontAwesomeIcon icon={loadingPeriod ? faSpinner : faMagnifyingGlass} spin={loadingPeriod} className="mr-2" />
            Load Period
          </button>
          {hasData && (
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition-colors"
            >
              <FontAwesomeIcon icon={faPrint} className="mr-2" />
              Print / Save PDF
            </button>
          )}
        </div>
      </div>

      {/* ─── ไม่มีข้อมูลในรอบ ─── */}
      {loaded && !hasData && (
        <div className="flex flex-col items-center justify-center py-12 px-4 mb-6 text-center text-slate-400 bg-white rounded-xl border border-slate-200 print:hidden">
          <FontAwesomeIcon icon={faFolderOpen} className="text-4xl mb-3 text-slate-300" />
          <p>No PM-approved timesheets found in {loaded.range.label}.</p>
          {record && (
            <p className="text-sm mt-1">
              This period was {record.status === 'APPROVED' ? 'signed off' : 'rejected'}
              {record.reviewedBy ? ` by ${record.reviewedBy.name}` : ''}.
            </p>
          )}
        </div>
      )}

      {/* ─── รายงานรอบ (ส่วนเดียวที่ถูกพิมพ์) ─── */}
      {loaded && agg && hasData && (
        <div className="print-report bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 print:shadow-none print:border-0 print:p-0">
          <div className="flex flex-wrap print:flex-nowrap justify-between items-start gap-4 mb-6 pb-4 border-b-2 border-slate-800">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={faHardHat} className="text-2xl text-amber-500" />
              <div>
                <h2 className="text-lg font-bold text-slate-800">Personal Timesheet App — Period Sign-off Report</h2>
                <p className="text-sm text-slate-600 mt-0.5">
                  Period: <span className="font-medium">{loaded.range.label}</span>
                </p>
              </div>
            </div>
            <div className="text-right text-xs text-slate-500 print:shrink-0">
              <div>Generated: {loaded.generatedAt}</div>
              <div className="font-medium mt-1">
                {record?.status === 'APPROVED' ? (
                  <span className="text-success">
                    <FontAwesomeIcon icon={faCircleCheck} className="mr-1" />
                    Approved
                  </span>
                ) : record?.status === 'REJECTED' ? (
                  <span className="text-danger">
                    <FontAwesomeIcon icon={faCircleXmark} className="mr-1" />
                    Rejected
                  </span>
                ) : (
                  <span className="text-amber-600">
                    <FontAwesomeIcon icon={faClock} className="mr-1" />
                    Not yet reviewed
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 print:grid-cols-4 gap-4 print:gap-3 mb-6">
            {[
              { label: 'Total Cost', value: formatMoney(agg.grandPay) },
              { label: 'Total Hours', value: formatHours(agg.grandHrs) },
              { label: 'Workers', value: String(agg.workerCount) },
              { label: 'Timesheets', value: String(agg.timesheetCount) },
            ].map((k) => (
              <div key={k.label} className="bg-slate-50 p-4 print:p-3 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{k.label}</p>
                <p className="text-xl print:text-lg font-bold text-slate-800">{k.value}</p>
              </div>
            ))}
          </div>

          {agg.grandUnpriced > 0 && (
            <p className="text-xs text-amber-600 mb-4">
              <FontAwesomeIcon icon={faTriangleExclamation} className="mr-1" />
              {formatHours(agg.grandUnpriced)} approved hrs still awaiting a pay rate from Accounting — these are excluded
              from Total Cost above.
            </p>
          )}
          {totalsChanged && (
            <p className="text-xs text-amber-600 mb-4 print:hidden">
              <FontAwesomeIcon icon={faTriangleExclamation} className="mr-1" />
              Total Cost has changed since sign-off (signed off at {formatMoney(snapshotCost)}), usually because
              Accounting added pay rates afterwards. Re-approve to record the current totals.
            </p>
          )}
          {overlapping.length > 0 && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-4 print:hidden">
              <FontAwesomeIcon icon={faTriangleExclamation} className="mr-1" />
              This range overlaps the signed-off period{periodText(overlapping)}. Signing off both would count the
              shared days twice in payroll.
            </p>
          )}

          <h4 className="font-semibold text-slate-800 mb-2">Summary by Worker</h4>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm text-left border border-slate-200 min-w-[640px]">
              <thead className="text-xs text-slate-600 bg-slate-50 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2">Worker</th>
                  <th className="px-4 py-2">Position</th>
                  <th className="px-4 py-2 text-center">ST</th>
                  <th className="px-4 py-2 text-center">OT1</th>
                  <th className="px-4 py-2 text-center">OT2</th>
                  <th className="px-4 py-2 text-center">Total Hrs</th>
                  <th className="px-4 py-2 text-right">Total Pay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agg.workerSummaries.map((w) => (
                  <tr key={w.workerId} className="break-inside-avoid">
                    <td className="px-4 py-2 font-medium text-slate-800 print:whitespace-nowrap">{w.workerName}</td>
                    <td className="px-4 py-2 text-slate-500 text-xs">{w.positions}</td>
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
                  <td className="px-4 py-2" colSpan={2}>
                    GRAND TOTAL
                  </td>
                  <td className="px-4 py-2 text-center">{formatHours(agg.grandSt)}</td>
                  <td className="px-4 py-2 text-center">{formatHours(agg.grandOt1)}</td>
                  <td className="px-4 py-2 text-center">{formatHours(agg.grandOt2)}</td>
                  <td className="px-4 py-2 text-center">{formatHours(agg.grandHrs)}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">{formatMoney(agg.grandPay)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ช่องลายเซ็นสำหรับฉบับพิมพ์ */}
          <div className="grid grid-cols-2 gap-8 mt-10 pt-6 border-t border-slate-300 text-sm break-inside-avoid">
            <div>
              <p className="text-slate-500 mb-8">Approved by (Top Management):</p>
              <p className="border-t border-slate-400 pt-1">
                {record?.status === 'APPROVED' ? record.reviewedBy?.name ?? '' : ' '}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {record?.status === 'APPROVED' ? new Date(record.reviewedAt).toLocaleString('en-US') : ' '}
              </p>
            </div>
            <div>
              <p className="text-slate-500 mb-8">Signature:</p>
              <p className="border-t border-slate-400 pt-1">&nbsp;</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 print:hidden">
            <button
              type="button"
              onClick={() => setDialog('reject')}
              disabled={acting}
              className="px-4 py-2 text-sm font-medium text-danger bg-white border border-danger/30 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={handleApproveClick}
              disabled={acting}
              className="px-6 py-2 text-sm font-medium text-white bg-success hover:bg-emerald-600 rounded-lg transition-colors shadow-sm disabled:opacity-70 disabled:cursor-wait"
            >
              <FontAwesomeIcon
                icon={acting && !dialog ? faSpinner : faCheck}
                spin={acting && !dialog}
                className="mr-2"
              />
              {record?.status === 'APPROVED' ? 'Re-approve (Sign-off)' : 'Approve (Sign-off)'}
            </button>
          </div>
        </div>
      )}

      {/* ─── ประวัติ ─── */}
      <h3 className="font-semibold text-slate-700 mb-3 ml-1 print:hidden">Sign-off History</h3>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4 print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[720px]">
            <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Period</th>
                <th className="px-6 py-3 text-right">Total Cost</th>
                <th className="px-6 py-3 text-center">Total Hrs</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Reviewed By</th>
                <th className="px-6 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historyState === 'loading' && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                    Loading...
                  </td>
                </tr>
              )}
              {historyState === 'error' && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-danger">
                    Could not load sign-off history.{' '}
                    <button type="button" onClick={() => void loadHistory()} className="underline">
                      Try again
                    </button>
                  </td>
                </tr>
              )}
              {historyState === 'ready' && periods.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    No periods have been reviewed yet.
                  </td>
                </tr>
              )}
              {historyState === 'ready' &&
                periods.map((p) => (
                  <tr key={p.id}>
                    <td className="px-6 py-3 font-medium whitespace-nowrap">
                      {toDateKey(p.periodStart)} to {toDateKey(p.periodEnd)}
                      {p.status === 'REJECTED' && p.notes && (
                        <span className="block text-xs font-normal text-red-600 mt-0.5 whitespace-normal">
                          {p.notes}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right font-mono">{formatMoney(p.totalCost)}</td>
                    <td className="px-6 py-3 text-center">{formatHours(p.totalHours)}</td>
                    <td className="px-6 py-3">
                      {p.status === 'APPROVED' ? (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium whitespace-nowrap">
                          <FontAwesomeIcon icon={faCheck} className="mr-1" />
                          Approved
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium whitespace-nowrap">
                          <FontAwesomeIcon icon={faXmark} className="mr-1" />
                          Rejected
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-slate-500">
                      {p.reviewedBy?.name ?? ''}
                      <span className="block text-xs text-slate-400">
                        {new Date(p.reviewedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => openHistoryPeriod(p)}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Load
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── หน้าต่างยืนยันการอนุมัติซ้ำ / ทับรอบ ─── */}
      {dialog === 'approve' && loaded && agg && (
        <Modal
          title="Confirm Sign-off"
          busy={acting}
          onClose={() => setDialog(null)}
          footer={
            <div className="flex justify-end gap-3">
              {cancelBtn}
              <button
                type="button"
                onClick={() => void approve()}
                disabled={acting}
                className="px-6 py-2 text-sm font-medium text-white bg-success hover:bg-emerald-600 rounded-lg shadow-sm disabled:opacity-70 disabled:cursor-wait"
              >
                <FontAwesomeIcon icon={acting ? faSpinner : faCheck} spin={acting} className="mr-2" />
                Approve anyway
              </button>
            </div>
          }
        >
          <div className="space-y-3 text-sm text-slate-700">
            {record?.status === 'APPROVED' && (
              <p>
                {loaded.range.label} was already approved
                {record.reviewedBy ? ` by ${record.reviewedBy.name}` : ''}. Re-approving replaces the recorded totals
                with the current ones ({formatMoney(agg.grandPay)}, {formatHours(agg.grandHrs)} hrs).
              </p>
            )}
            {overlapping.length > 0 && (
              <p className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                <FontAwesomeIcon icon={faTriangleExclamation} className="mr-1" />
                This range overlaps the signed-off period{periodText(overlapping)}. The shared days would be counted
                twice in payroll. Reject that period first unless you are sure.
              </p>
            )}
          </div>
        </Modal>
      )}

      {/* ─── หน้าต่างยืนยันการตีกลับทั้งรอบ ─── */}
      {dialog === 'reject' && loaded && agg && (
        <Modal
          title="Reject this period?"
          busy={acting}
          onClose={() => setDialog(null)}
          footer={
            <div className="flex justify-end gap-3">
              {cancelBtn}
              <button
                type="button"
                onClick={() => void reject()}
                disabled={acting}
                className="px-5 py-2 text-sm font-medium text-white bg-danger hover:bg-red-600 rounded-lg shadow-sm disabled:opacity-70 disabled:cursor-wait"
              >
                <FontAwesomeIcon icon={acting ? faSpinner : faRotateLeft} spin={acting} className="mr-2" />
                Reject and send back to PM
              </button>
            </div>
          }
        >
          <div className="space-y-4 text-sm text-slate-700">
            <p>
              <strong>{agg.timesheetCount} PM-approved timesheet(s)</strong> in {loaded.range.label} will be sent back
              to Pending for PM to review again. Each will show your name and reason.
            </p>
            <div>
              <label htmlFor="period-reason" className="block font-medium text-slate-700 mb-1">
                Reason <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="period-reason"
                rows={2}
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="E.g., OT on Site A looks too high — please re-check with foremen."
                className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-secondary focus:border-secondary outline-none resize-none"
              />
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
