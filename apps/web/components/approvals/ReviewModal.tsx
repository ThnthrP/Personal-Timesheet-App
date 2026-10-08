'use client';

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck,
  faCircleInfo,
  faRotateLeft,
  faSpinner,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import type { Timesheet } from '../../lib/types';
import { formatHours, formatMoney, toDateKey } from '../../lib/format';
import { calcLineCost, type RateResolver } from '../../lib/rates';
import { Modal } from '../Modal';

interface ReviewModalProps {
  timesheet: Timesheet;
  /** null = โหลดอัตราค่าจ้างไม่ได้ (ไม่มีสิทธิ์หรือ error) — ซ่อนคอลัมน์ค่าจ้าง */
  resolveRate: RateResolver | null;
  busy: 'approve' | 'reject' | null;
  onClose: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
}

/** หน้าต่าง Review Timesheet — เหมือน #pm-review-modal ของ prototype */
export function ReviewModal({ timesheet: ts, resolveRate, busy, onClose, onApprove, onReject }: ReviewModalProps) {
  // prototype ใช้ prompt() ของเบราว์เซอร์ — ที่นี่ใช้ช่องกรอกในหน้าต่างเดียวกันแทน
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const dateKey = toDateKey(ts.date);

  let total = 0;
  let unpriced = 0;
  const rows = ts.entries.map((e) => {
    const rate = resolveRate ? resolveRate(e.workerId, e.tradeId, dateKey) : null;
    const cost = rate != null ? calcLineCost(rate, e.st, e.ot1, e.ot2) : null;
    if (cost == null) unpriced += 1;
    else total += cost;
    return { e, rate, cost };
  });

  const footer = rejecting ? (
    <div className="space-y-3">
      <label htmlFor="reject-reason" className="block text-sm font-medium text-slate-700">
        Reason for rejecting this timesheet <span className="text-slate-400 font-normal">(shown to the foreman — optional)</span>
      </label>
      <textarea
        id="reject-reason"
        rows={2}
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="E.g., Worker A's end time should be 17:00, not 19:00."
        className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-secondary focus:border-secondary outline-none resize-none"
      />
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => setRejecting(false)}
          disabled={busy !== null}
          className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => onReject(reason.trim())}
          disabled={busy !== null}
          className="px-5 py-2 text-sm font-medium text-white bg-danger hover:bg-red-600 rounded-lg transition-colors shadow-sm disabled:cursor-wait disabled:opacity-70"
        >
          {busy === 'reject' ? (
            <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
          ) : (
            <FontAwesomeIcon icon={faRotateLeft} className="mr-2" />
          )}
          Confirm Reject &amp; Return
        </button>
      </div>
    </div>
  ) : (
    <div className="flex flex-wrap justify-between items-center gap-3">
      <button
        type="button"
        onClick={() => setRejecting(true)}
        disabled={busy !== null}
        className="px-4 py-2 text-sm font-medium text-danger bg-white border border-danger/30 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
      >
        Reject &amp; Return
      </button>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={busy !== null}
          className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onApprove}
          disabled={busy !== null}
          className="px-6 py-2 text-sm font-medium text-white bg-success hover:bg-emerald-600 rounded-lg transition-colors shadow-sm disabled:cursor-wait disabled:opacity-70"
        >
          <FontAwesomeIcon icon={busy === 'approve' ? faSpinner : faCheck} spin={busy === 'approve'} className="mr-2" />
          Approve (Sign-off)
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      busy={busy !== null}
      onClose={onClose}
      footer={footer}
      title={
        <>
          Review Timesheet{' '}
          <span className="text-slate-500 text-sm font-mono font-normal ml-2" title={ts.id}>
            {ts.id.slice(0, 8)}
          </span>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mb-6 text-sm">
        <div>
          <span className="text-slate-500">Project:</span>{' '}
          <span className="font-medium text-slate-800">
            {ts.project.code} — {ts.project.name}
          </span>
        </div>
        <div>
          <span className="text-slate-500">Date:</span>{' '}
          <span className="font-medium text-slate-800">{dateKey}</span>
          {ts.dayType !== 'STANDARD' && (
            <span className="ml-2 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
              {ts.dayType === 'WEEKEND' ? 'Weekend' : 'Holiday'} — all OT2
            </span>
          )}
        </div>
        <div>
          <span className="text-slate-500">Job Code:</span>{' '}
          <span className="font-medium text-slate-800">{ts.jobCode || '(none)'}</span>
        </div>
        <div>
          <span className="text-slate-500">Foreman:</span>{' '}
          <span className="font-medium text-slate-800">{ts.foreman.name}</span>
        </div>
      </div>

      {ts.returnedBy && (
        <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-sm mb-4 border border-amber-200 flex gap-2">
          <FontAwesomeIcon icon={faRotateLeft} className="mt-0.5" />
          <div>
            <strong>Returned by Top Management ({ts.returnedBy.name}):</strong>{' '}
            <span className="italic">{ts.returnReason || 'No reason given.'}</span>
          </div>
        </div>
      )}

      <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm mb-6 border border-blue-100 flex gap-2">
        <FontAwesomeIcon icon={faCircleInfo} className="mt-0.5" />
        <div className="min-w-0 break-words">
          <strong>Foreman Notes:</strong> <span className="italic">{ts.notes || 'No notes provided.'}</span>
        </div>
      </div>

      <h4 className="font-medium text-slate-800 mb-3 border-b border-slate-200 pb-2">Worker Details &amp; Hours</h4>
      <div className="overflow-x-auto rounded border border-slate-200 mb-4">
        <table className="w-full text-sm text-left min-w-[640px]">
          <thead className="text-xs text-slate-600 bg-slate-50 uppercase border-b border-slate-200">
            <tr>
              <th className="px-4 py-2">Worker</th>
              <th className="px-4 py-2">Trade</th>
              <th className="px-4 py-2 text-center">Time</th>
              <th className="px-4 py-2 text-center">ST (1.0x)</th>
              <th className="px-4 py-2 text-center">OT1 (1.5x)</th>
              <th className="px-4 py-2 text-center">OT2 (2.0x)</th>
              {resolveRate && (
                <th className="px-4 py-2 text-right">
                  Est. Cost <span className="normal-case font-normal text-slate-400">(if rate on file)</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ e, rate, cost }) => (
              <tr key={e.id}>
                <td className="px-4 py-2 font-medium text-slate-700">{e.worker.name}</td>
                <td className="px-4 py-2 text-slate-500 text-xs">
                  {e.trade.name}
                  {resolveRate && (
                    <>
                      <br />
                      {rate != null ? `฿${rate.toFixed(2)}/hr` : <span className="text-amber-600">rate pending</span>}
                    </>
                  )}
                </td>
                <td className="px-4 py-2 text-center text-xs font-mono text-slate-500 whitespace-nowrap">
                  {e.startTime} - {e.endTime}
                </td>
                <td className="px-4 py-2 text-center text-slate-700">{e.st > 0 ? formatHours(e.st) : '-'}</td>
                <td className={`px-4 py-2 text-center ${e.ot1 > 0 ? 'text-accent font-medium' : 'text-slate-400'}`}>
                  {e.ot1 > 0 ? formatHours(e.ot1) : '-'}
                </td>
                <td className={`px-4 py-2 text-center ${e.ot2 > 0 ? 'text-danger font-medium' : 'text-slate-400'}`}>
                  {e.ot2 > 0 ? formatHours(e.ot2) : '-'}
                </td>
                {resolveRate && (
                  <td className="px-4 py-2 text-right font-mono">
                    {cost != null ? formatMoney(cost) : <span className="text-slate-400">—</span>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {resolveRate && (
            <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800">
              <tr>
                <td colSpan={6} className="px-4 py-2 text-right">
                  Total Est. Cost:
                </td>
                <td className="px-4 py-2 text-right text-primary whitespace-nowrap">
                  {formatMoney(total)}
                  {unpriced > 0 && (
                    <span className="block text-xs font-normal text-amber-600">+{unpriced} pending rate</span>
                  )}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="bg-amber-50 p-3 rounded border border-amber-200 text-sm text-amber-800">
        <FontAwesomeIcon icon={faTriangleExclamation} className="mr-1" /> By approving, you authorize these hours for
        payroll processing. Wage rates are set separately by Accounting and applied when payroll is calculated.
      </div>
    </Modal>
  );
}
