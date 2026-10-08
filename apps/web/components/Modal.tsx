'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';

interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** ปิดด้วย Esc / คลิกพื้นหลังไม่ได้ระหว่างกำลังบันทึก */
  busy?: boolean;
}

/** หน้าต่างลอยแบบ .modal-overlay ของ prototype (พื้นหลังมืด + เบลอ) */
export function Modal({ title, onClose, children, footer, busy = false }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    // ล็อกการเลื่อนหน้าด้านหลังระหว่างเปิดหน้าต่าง
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus();
    };
  }, [onClose, busy]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] outline-none"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center gap-4 bg-slate-50 rounded-t-xl">
          <h3 className="font-bold text-slate-800 text-lg min-w-0">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-700 transition-colors p-1 disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faXmark} className="text-xl" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">{footer}</div>
        )}
      </div>
    </div>
  );
}
