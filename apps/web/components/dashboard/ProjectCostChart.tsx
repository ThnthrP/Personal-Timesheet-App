'use client';

import { useState } from 'react';
import { formatHours, formatMoney } from '../../lib/format';

export interface ProjectCost {
  key: string;
  code: string;
  name: string;
  cost: number;
  hours: number;
}

/**
 * ต้นทุนแยกตามโครงการ — แท่งแนวนอนสีเดียว (เทียบขนาด) เรียงมากไปน้อย พร้อมตัวเลขกำกับปลายแท่ง
 * แนวนอนอ่านรหัสโครงการยาวๆ เช่น ON/037-01/2026 ได้ครบ (prototype ใช้แท่งตั้งซึ่งชื่อเบียดกัน)
 */
export function ProjectCostChart({ data }: { data: ProjectCost[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(...data.map((d) => d.cost), 0);

  if (data.length === 0) {
    return <p className="text-sm text-slate-400 py-10 text-center">No approved hours in this range.</p>;
  }

  return (
    <ul className="space-y-3" aria-label="Labor cost by project">
      {data.map((d) => {
        const pct = max > 0 ? (d.cost / max) * 100 : 0;
        const active = hover === d.key;
        return (
          <li
            key={d.key}
            className="relative"
            onMouseEnter={() => setHover(d.key)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(d.key)}
            onBlur={() => setHover(null)}
            tabIndex={0}
          >
            <div className="flex justify-between items-baseline gap-3 text-xs mb-1">
              <span className="font-medium text-slate-700 truncate" title={d.name}>
                {d.code}
                <span className="text-slate-400 font-normal"> · {d.name}</span>
              </span>
              <span className="font-mono text-slate-700 shrink-0">{formatMoney(d.cost)}</span>
            </div>
            <div className="h-5 bg-slate-100 rounded">
              <div
                className={`h-5 rounded transition-opacity ${active || !hover ? 'opacity-100' : 'opacity-60'}`}
                style={{ width: `${Math.max(pct, d.cost > 0 ? 1 : 0)}%`, background: '#1e3a8a' }}
              />
            </div>
            {active && (
              <div
                role="tooltip"
                className="absolute z-10 right-0 -top-12 bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none whitespace-nowrap"
              >
                <div className="font-medium">{d.code}</div>
                <div>
                  {formatMoney(d.cost)} · {formatHours(d.hours)} hrs
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
