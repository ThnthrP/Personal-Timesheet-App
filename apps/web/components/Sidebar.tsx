'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHardHat, faRightFromBracket, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../lib/auth-context';
import { findNavItem, initials, navItemsFor, ROLE_LABELS } from '../lib/nav';

interface SidebarProps {
  /** มือถือ: sidebar ซ่อนอยู่ด้านซ้าย เปิดด้วยปุ่มเมนูบน header */
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  if (!user?.role) return null;

  const items = navItemsFor(user.role);
  const activeHref = findNavItem(pathname)?.href;

  return (
    <>
      {/* พื้นหลังมืดหลัง sidebar บนมือถือ — แตะเพื่อปิด */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-primary text-white flex flex-col shadow-xl transition-transform duration-200 md:static md:z-20 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-blue-800 flex items-center gap-3">
          <FontAwesomeIcon icon={faHardHat} className="text-2xl text-accent shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-lg leading-tight break-words">Personal Timesheet App</h1>
            <p className="text-xs text-blue-300">Timesheet System</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="md:hidden text-blue-300 hover:text-white p-1"
          >
            <FontAwesomeIcon icon={faXmark} className="text-xl" />
          </button>
        </div>

        <nav className="flex-1 py-4 space-y-1 overflow-y-auto" aria-label="Main">
          <div className="px-4 pb-2 text-xs font-semibold text-blue-300 uppercase tracking-wider">
            Role Portals
          </div>
          {items.map((item) => {
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={active ? 'page' : undefined}
                className={`block px-6 py-3 text-sm font-medium border-l-4 transition-colors hover:bg-blue-800 hover:text-white ${
                  active ? 'bg-blue-800 border-accent text-white' : 'border-transparent text-blue-100'
                }`}
              >
                <FontAwesomeIcon icon={item.icon} className="w-5 mr-2" />
                {item.label}
                <span className="text-xs font-normal text-blue-400 block ml-7">{item.subtitle}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-blue-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
              {initials(user.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-blue-300">{ROLE_LABELS[user.role]}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Sign Out"
              aria-label="Sign out"
              className="text-blue-300 hover:text-white transition-colors p-1"
            >
              <FontAwesomeIcon icon={faRightFromBracket} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
