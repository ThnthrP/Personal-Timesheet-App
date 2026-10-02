import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faClipboardUser,
  faFileSignature,
  faChartPie,
  faStamp,
  faMoneyCheckDollar,
  faFileContract,
  faSliders,
} from '@fortawesome/free-solid-svg-icons';
import type { Role } from './types';

export interface NavItem {
  href: string;
  label: string;
  subtitle: string; // บรรทัดเล็กใต้ชื่อเมนู เหมือน prototype
  title: string; // หัวข้อบน header ของหน้านั้น
  icon: IconDefinition;
  roles: Role[];
}

// ลำดับ เมนู ไอคอน และหัวข้อ ตรงกับ prototype ทุกตัว
export const NAV_ITEMS: NavItem[] = [
  { href: '/field-input', label: 'Field Input', subtitle: 'Foreman / Supervisor', title: 'Field Timesheet Input', icon: faClipboardUser, roles: ['FOREMAN', 'ADMIN'] },
  { href: '/approvals', label: 'Approvals', subtitle: 'Project Manager', title: 'Timesheet Approvals', icon: faFileSignature, roles: ['PM', 'ADMIN'] },
  { href: '/dashboard', label: 'Dashboard', subtitle: 'Top Management', title: 'Executive Dashboard', icon: faChartPie, roles: ['EXEC', 'ADMIN'] },
  { href: '/period-sign-off', label: 'Period Sign-off', subtitle: 'Top Management', title: 'Period Sign-off', icon: faStamp, roles: ['EXEC', 'ADMIN'] },
  { href: '/payroll', label: 'Payroll', subtitle: 'Accounting', title: 'Payroll by Worker', icon: faMoneyCheckDollar, roles: ['ACCOUNTING', 'ADMIN'] },
  { href: '/worker-contracts', label: 'Worker Contracts', subtitle: 'Accounting', title: 'Worker Contracts', icon: faFileContract, roles: ['ACCOUNTING', 'ADMIN'] },
  { href: '/admin', label: 'Admin', subtitle: 'Master Data', title: 'Master Data Administration', icon: faSliders, roles: ['ADMIN'] },
];

// หน้าแรกหลัง login ของแต่ละ role (ตาม prototype — Admin เริ่มที่ Field Input)
const DEFAULT_PATH: Record<Role, string> = {
  FOREMAN: '/field-input',
  PM: '/approvals',
  EXEC: '/dashboard',
  ACCOUNTING: '/payroll',
  ADMIN: '/field-input',
};

export const ROLE_LABELS: Record<Role, string> = {
  FOREMAN: 'Foreman',
  PM: 'Project Manager',
  EXEC: 'Operations Director',
  ACCOUNTING: 'Accounting',
  ADMIN: 'Administrator',
};

export function navItemsFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function defaultPathFor(role: Role): string {
  return DEFAULT_PATH[role];
}

/** หาเมนูที่ตรงกับ path ปัจจุบัน (รองรับหน้าย่อย เช่น /admin/workers) */
export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(item.href + '/'));
}

/** ตัวย่อชื่อใน avatar เช่น "Mike Supervisor" → "MS" (เหมือน prototype) */
export function initials(name: string): string {
  return (
    name
      .split(/[ ,]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || '?'
  );
}
