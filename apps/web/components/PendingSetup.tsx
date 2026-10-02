'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserClock } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../lib/auth-context';

/** login ได้แต่ยังไม่มี role (User.role = null) — ข้อความเดียวกับ prototype */
export function PendingSetup() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-8 text-center">
        <FontAwesomeIcon icon={faUserClock} className="text-4xl text-amber-500 mb-3" />
        <h2 className="font-bold text-lg text-slate-800 mb-1">Account Pending Setup</h2>
        <p className="text-sm text-slate-500 mb-1">
          Signed in as <span className="font-medium text-slate-700">{user?.email}</span>
        </p>
        <p className="text-sm text-slate-500 mb-6">
          Your login works, but no role has been assigned yet. Contact your administrator to finish setting up your account.
        </p>
        <button
          type="button"
          onClick={logout}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 rounded-lg border border-slate-300 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
