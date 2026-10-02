'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCommentDots, faPen } from '@fortawesome/free-solid-svg-icons';
import type { Timesheet } from '../../lib/types';
import { formatHours, toDateKey } from '../../lib/format';
import { StatusBadge } from '../StatusBadge';

interface SubmissionHistoryProps {
  title: string;
  timesheets: Timesheet[];
  currentUserId: string;
  /** ปุ่ม Edit & Resubmit — แสดงเฉพาะใบที่ถูก Reject และเป็นของผู้ใช้คนนี้เอง (เหมือน prototype) */
  onEdit: (ts: Timesheet) => void;
  editingId: string | null;
}

export function SubmissionHistory({ title, timesheets, currentUserId, onEdit, editingId }: SubmissionHistoryProps) {
  return (
    <>
      <h3 className="font-semibold text-slate-700 mb-3 ml-1">{title}</h3>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[760px]">
            <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Project / Job Code</th>
                <th className="px-6 py-3">Submitted By</th>
                <th className="px-6 py-3">Total Hours</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {timesheets.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                    No submissions yet.
                  </td>
                </tr>
              )}
              {timesheets.map((ts) => {
                const totalHrs = ts.entries.reduce((sum, e) => sum + e.st + e.ot1 + e.ot2, 0);
                const canEdit = ts.status === 'REJECTED' && ts.foremanId === currentUserId;
                const isBeingEdited = ts.id === editingId;
                return (
                  <tr key={ts.id} className={isBeingEdited ? 'bg-amber-50' : undefined}>
                    <td className="px-6 py-3 font-medium align-top">
                      {toDateKey(ts.date)}
                      <span className="text-xs text-slate-400 block font-mono font-normal" title={ts.id}>
                        {ts.id.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-6 py-3 align-top">
                      {ts.project.code}
                      <br />
                      {ts.jobCode ? (
                        <span className="text-xs text-slate-500">{ts.jobCode}</span>
                      ) : (
                        <span className="text-xs text-slate-300">No job code</span>
                      )}
                      {ts.status === 'REJECTED' && (
                        <div className="text-xs text-red-600 mt-1">
                          <FontAwesomeIcon icon={faCommentDots} className="mr-1" />
                          {ts.reviewedBy ? `${ts.reviewedBy.name}: ` : ''}
                          {ts.rejectReason || 'No reason given'}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3 text-slate-600 align-top">{ts.foreman.name}</td>
                    <td className="px-6 py-3 align-top whitespace-nowrap">
                      {formatHours(totalHrs)} hrs
                      <span className="text-xs text-slate-400 block">({ts.entries.length} men)</span>
                    </td>
                    <td className="px-6 py-3 align-top">
                      <StatusBadge status={ts.status} />
                    </td>
                    <td className="px-6 py-3 text-center align-top">
                      {canEdit &&
                        (isBeingEdited ? (
                          <span className="text-xs text-amber-700 font-medium">Editing above</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onEdit(ts)}
                            className="text-xs text-primary hover:underline font-medium whitespace-nowrap"
                          >
                            <FontAwesomeIcon icon={faPen} className="mr-1" />
                            Edit &amp; Resubmit
                          </button>
                        ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
