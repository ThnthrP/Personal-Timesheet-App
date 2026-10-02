'use client';

import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';

type ShowToast = (message: string, isError?: boolean) => void;

const ToastContext = createContext<ShowToast>(() => {});

/** แถบข้อความลอยด้านล่างกลางจอ แบบเดียวกับ toast() ของ prototype */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback<ShowToast>((message, isError = false) => {
    clearTimeout(timer.current);
    setToast({ message, isError });
    // error ค้างนานกว่า เพราะมักเป็นข้อความจาก server ที่ยาวกว่าและต้องอ่าน
    timer.current = setTimeout(() => setToast(null), isError ? 5000 : 3000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* live region อยู่ตลอด เพื่อให้ screen reader อ่านข้อความใหม่ทุกครั้ง */}
      <div aria-live="polite" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] w-max max-w-[90vw]">
        {toast && (
          <div
            role={toast.isError ? 'alert' : 'status'}
            className={`px-6 py-3 rounded-full shadow-xl text-sm text-white text-center ${
              toast.isError ? 'bg-danger' : 'bg-slate-900'
            }`}
          >
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
