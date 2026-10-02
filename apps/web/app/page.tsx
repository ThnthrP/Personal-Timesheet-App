'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { defaultPathFor } from '../lib/nav';
import { PendingSetup } from '../components/PendingSetup';

/** "/" ไม่มีเนื้อหาของตัวเอง — พาไปหน้าแรกของ role หรือหน้า login */
export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (user.role) router.replace(defaultPathFor(user.role));
  }, [loading, user, router]);

  if (!loading && user && !user.role) return <PendingSetup />;
  return <div className="min-h-screen bg-slate-100" />;
}
