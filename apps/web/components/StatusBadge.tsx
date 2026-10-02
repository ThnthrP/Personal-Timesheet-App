import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
import { faClock } from '@fortawesome/free-regular-svg-icons';
import type { TimesheetStatus } from '../lib/types';

/** ป้ายสถานะ timesheet — สีและข้อความเดียวกับ prototype */
export function StatusBadge({ status }: { status: TimesheetStatus }) {
  if (status === 'APPROVED') {
    return (
      <span className="inline-flex items-center px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium whitespace-nowrap">
        <FontAwesomeIcon icon={faCheck} className="mr-1" />
        Approved
      </span>
    );
  }
  if (status === 'REJECTED') {
    return (
      <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium whitespace-nowrap">
        <FontAwesomeIcon icon={faXmark} className="mr-1" />
        Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium whitespace-nowrap">
      <FontAwesomeIcon icon={faClock} className="mr-1" />
      Pending PM
    </span>
  );
}
