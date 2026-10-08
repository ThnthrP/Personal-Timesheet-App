'use client';

import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import { faClock } from '@fortawesome/free-regular-svg-icons';

interface AppHeaderProps {
  title: string;
  onOpenMenu: () => void;
}

export function AppHeader({ title, onOpenMenu }: AppHeaderProps) {
  // วันที่คำนวณหลัง mount เท่านั้น — ถ้าคำนวณตอน server render จะได้เวลา/timezone ของ server
  // ไม่ตรงกับเครื่องผู้ใช้ และ React จะเตือน hydration mismatch
  const [today, setToday] = useState('');
  useEffect(() => {
    setToday(
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    );
  }, []);

  return (
    <header className="bg-white shadow-sm z-10 border-b border-slate-200 print:hidden">
      <div className="flex justify-between items-center gap-4 px-4 py-4 md:px-8">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open menu"
            className="md:hidden text-slate-600 hover:text-slate-900 p-1 -ml-1"
          >
            <FontAwesomeIcon icon={faBars} className="text-xl" />
          </button>
          <h2 className="text-xl font-bold text-slate-800 truncate">{title}</h2>
        </div>
        {today && (
          <div className="hidden sm:block text-sm text-slate-500 shrink-0">
            <FontAwesomeIcon icon={faClock} className="mr-1" /> {today}
          </div>
        )}
      </div>
    </header>
  );
}
