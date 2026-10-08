'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faSpinner } from '@fortawesome/free-solid-svg-icons';
import type { ReactNode } from 'react';

export const fieldClass =
  'w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/35 bg-white';

export const primaryBtn =
  'px-4 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-70 disabled:cursor-wait whitespace-nowrap';

/** ฟอร์มเพิ่มข้อมูลบนสุดของแต่ละแท็บ — กด Enter เพื่อบันทึกได้ */
export function AddForm({ onSubmit, children }: { onSubmit: () => void; children: ReactNode }) {
  return (
    <form
      className="flex flex-wrap gap-3 items-end bg-white p-4 rounded-xl border border-slate-200 mb-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder,
  inactiveCount,
  showInactive,
  onShowInactive,
  extra,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  inactiveCount?: number;
  showInactive?: boolean;
  onShowInactive?: (v: boolean) => void;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
      <div className="relative w-full sm:w-72">
        <FontAwesomeIcon
          icon={faMagnifyingGlass}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"
        />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className={`${fieldClass} pl-9`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {!!inactiveCount && onShowInactive && (
          <label className="text-sm text-slate-600 flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!showInactive} onChange={(e) => onShowInactive(e.target.checked)} />
            Show inactive ({inactiveCount})
          </label>
        )}
        {extra}
      </div>
    </div>
  );
}

export function TableCard({ head, children, empty }: { head: ReactNode; children: ReactNode; empty?: string | null }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left min-w-[560px]">
          <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b border-slate-200">{head}</thead>
          <tbody className="divide-y divide-slate-100">
            {empty ? (
              <tr>
                <td colSpan={10} className="px-6 py-8 text-center text-slate-400">
                  {empty}
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StatusText({ active }: { active: boolean }) {
  return active ? (
    <span className="text-success text-xs">Active</span>
  ) : (
    <span className="text-slate-400 text-xs">Inactive</span>
  );
}

export function ToggleButton({ active, busy, onClick }: { active: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="text-xs text-secondary hover:underline disabled:opacity-50"
    >
      {busy ? <FontAwesomeIcon icon={faSpinner} spin /> : active ? 'Deactivate' : 'Reactivate'}
    </button>
  );
}

/** ค้นหาแบบไม่สนตัวพิมพ์ในหลายช่อง */
export function matches(q: string, ...fields: (string | null | undefined)[]) {
  const s = q.trim().toLowerCase();
  return !s || fields.some((f) => f?.toLowerCase().includes(s));
}
