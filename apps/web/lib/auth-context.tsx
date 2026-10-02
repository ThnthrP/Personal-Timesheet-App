'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';
import type { Role, User } from './types';

export type { Role, User } from './types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

/**
 * POST /auth/login คืน { id, email, name, role }
 * แต่ GET /auth/me คืน req.user จาก JWT ซึ่งเป็น { userId, email, role } (ไม่มี name)
 * ฟังก์ชันนี้รวมทั้งสองแบบให้เป็นรูปเดียวกัน — ถ้าไม่มี name จะใช้อีเมลแสดงแทน
 * (ถ้าแก้ /auth/me ให้คืน name ตาม "ขั้นที่ 0" ของอีกแชท ชื่อจริงจะแสดงเองโดยไม่ต้องแก้ไฟล์นี้)
 */
interface RawUser {
  id?: string;
  userId?: string;
  email: string;
  name?: string;
  role: Role | null;
}

function normalizeUser(raw: RawUser): User {
  return {
    id: raw.id ?? raw.userId ?? '',
    email: raw.email,
    name: raw.name || raw.email,
    role: raw.role ?? null,
  };
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // ตอนเปิด/refresh หน้า: ถาม backend ว่า cookie ยังใช้ได้ไหม
  useEffect(() => {
    api
      .get<{ user: RawUser }>('/auth/me')
      .then((res) => setUser(normalizeUser(res.data.user)))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // cookie หมดอายุ (8 ชม.) ระหว่างใช้งาน → API ตอบ 401 → ล้าง user แล้ว layout จะพาไปหน้า login เอง
  // ไม่นับ /auth/* เพราะ login ผิดก็ได้ 401 ซึ่งหน้า login แสดงข้อความเอง
  useEffect(() => {
    const id = api.interceptors.response.use(undefined, (err) => {
      const status = err?.response?.status;
      const url: string = err?.config?.url ?? '';
      if (status === 401 && !url.startsWith('/auth/')) setUser(null);
      return Promise.reject(err);
    });
    return () => api.interceptors.response.eject(id);
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<{ user: RawUser }>('/auth/login', { email, password });
    setUser(normalizeUser(res.data.user));
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      // ถึง request ล้มเหลว (เช่น server ดับ) ก็ล้างสถานะฝั่ง client แล้วพากลับหน้า login
      setUser(null);
      router.push('/login');
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
