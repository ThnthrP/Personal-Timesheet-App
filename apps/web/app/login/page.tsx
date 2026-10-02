'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHardHat, faRightToBracket, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../lib/auth-context';
import { apiErrorMessage } from '../../lib/api-errors';

const inputClass =
  'w-full border border-slate-300 rounded-lg px-4 py-2 outline-none ' +
  'focus:ring-2 focus:ring-secondary focus:border-secondary';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showResetHelp, setShowResetHelp] = useState(false);

  // login อยู่แล้ว หรือเพิ่ง login สำเร็จ → ไปหน้าแรก
  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, user, router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      // redirect ทำใน useEffect ด้านบนเมื่อ user ถูก set
    } catch (err) {
      setError(apiErrorMessage(err, 'Sign in failed. Please try again.'));
      setSubmitting(false);
    }
  }

  // ระหว่างเช็ค session แสดงแค่พื้นหลัง (กันฟอร์มกระพริบก่อน redirect)
  if (loading || user) {
    return <div className="min-h-screen bg-slate-900" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-8">
        <div className="flex flex-col items-center mb-6">
          <FontAwesomeIcon icon={faHardHat} className="text-4xl text-amber-500 mb-2" />
          <h1 className="font-bold text-xl text-slate-800">Personal Timesheet App</h1>
          <p className="text-xs text-slate-500">Timesheet System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="text-sm text-danger bg-red-50 border border-red-200 rounded-lg px-3 py-2"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary text-white font-medium py-2 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-70 disabled:cursor-wait"
          >
            <FontAwesomeIcon
              icon={submitting ? faSpinner : faRightToBracket}
              spin={submitting}
              className="mr-2"
            />
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>

          {/* ระบบใหม่ยังไม่มีการรีเซ็ตรหัสผ่านทางอีเมล — แจ้งให้ติดต่อ Admin แทน */}
          <button
            type="button"
            onClick={() => setShowResetHelp((v) => !v)}
            aria-expanded={showResetHelp}
            className="w-full text-center text-xs text-slate-500 hover:text-secondary transition-colors"
          >
            Forgot password?
          </button>
          {showResetHelp && (
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-center">
              Ask your administrator to reset your password.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
