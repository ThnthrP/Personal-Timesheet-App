'use client';

import { useState } from 'react';
import { formatHours } from '../../lib/format';

/** สีเดียวกับตัวเลข ST / OT1 / OT2 ในหน้าอื่นของแอป (ผ่านการตรวจสีสำหรับผู้ตาบอดสีแล้ว) */
const SEGMENTS = [
  { key: 'st', label: 'Standard (1.0x)', color: '#3b82f6' },
  { key: 'ot1', label: 'OT1 (1.5x)', color: '#f59e0b' },
  { key: 'ot2', label: 'OT2 (2.0x)', color: '#ef4444' },
] as const;

/**
 * สัดส่วนชั่วโมง — แท่งซ้อน 100% แทนกราฟโดนัทของ prototype (อ่านสัดส่วนได้แม่นกว่า)
 * มีตัวเลขและเปอร์เซ็นต์กำกับทุกส่วน สีจึงไม่ใช่สิ่งเดียวที่บอกความหมาย
 */
export function HoursDistribution({ st, ot1, ot2 }: { st: number; ot1: number; ot2: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const values = { st, ot1, ot2 };
  const total = st + ot1 + ot2;

  if (total === 0) {
    return <p className="text-sm text-slate-400 py-10 text-center">No hours yet.</p>;
  }

  return (
    <div>
      <div className="flex h-8 gap-[2px] rounded overflow-hidden mb-5" aria-hidden="true">
        {SEGMENTS.filter((s) => values[s.key] > 0).map((s) => (
          <div
            key={s.key}
            onMouseEnter={() => setHover(s.key)}
            onMouseLeave={() => setHover(null)}
            className={`transition-opacity ${!hover || hover === s.key ? 'opacity-100' : 'opacity-40'}`}
            style={{ width: `${(values[s.key] / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${formatHours(values[s.key])} hrs`}
          />
        ))}
      </div>
      <ul className="space-y-3 text-sm">
        {SEGMENTS.map((s) => {
          const v = values[s.key];
          return (
            <li
              key={s.key}
              onMouseEnter={() => setHover(s.key)}
              onMouseLeave={() => setHover(null)}
              className={`flex items-center gap-3 transition-opacity ${!hover || hover === s.key ? '' : 'opacity-50'}`}
            >
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: s.color }} aria-hidden="true" />
              <span className="flex-1 text-slate-600">{s.label}</span>
              <span className="font-medium text-slate-800 tabular-nums">{formatHours(v)} hrs</span>
              <span className="w-12 text-right text-slate-400 tabular-nums">{Math.round((v / total) * 100)}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
