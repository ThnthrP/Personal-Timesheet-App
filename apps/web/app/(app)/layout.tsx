'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { defaultPathFor, findNavItem } from '../../lib/nav';
import { Sidebar } from '../../components/Sidebar';
import { AppHeader } from '../../components/AppHeader';
import { PendingSetup } from '../../components/PendingSetup';

/**
 * โครงหน้าหลักหลัง login (sidebar + header) — ครอบทุกหน้าในโฟลเดอร์ app/(app)/
 *
 * การป้องกันหน้า:
 * - ยังไม่ login → ไป /login
 * - login แล้วแต่ไม่มี role → หน้า Account Pending Setup
 * - เปิดหน้าที่ role ตัวเองไม่มีสิทธิ์ (เช่น Foreman พิมพ์ /payroll เอง) → กลับหน้าแรกของ role นั้น
 *
 * นี่คือการป้องกันฝั่งหน้าจอเท่านั้น ความปลอดภัยจริงอยู่ที่ API (JwtAuthGuard + RolesGuard)
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItem = findNavItem(pathname);
  const role = user?.role ?? null;
  const allowed = role !== null && (!navItem || navItem.roles.includes(role));

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (role && !allowed) router.replace(defaultPathFor(role));
  }, [loading, user, role, allowed, router]);

  if (loading || !user) return <div className="min-h-screen bg-slate-100" />;
  if (!role) return <PendingSetup />;
  if (!allowed) return <div className="min-h-screen bg-slate-100" />;

  return (
    <div className="flex h-dvh w-full overflow-hidden text-slate-800 print:block print:h-auto print:overflow-visible">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-100 print:h-auto print:overflow-visible print:bg-white">
        <AppHeader title={navItem?.title ?? ''} onOpenMenu={() => setSidebarOpen(true)} />
        <div className="flex-1 overflow-y-auto p-4 md:p-8 print:overflow-visible print:p-0">{children}</div>
      </main>
    </div>
  );
}
