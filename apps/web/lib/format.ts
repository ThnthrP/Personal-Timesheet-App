import type { DecimalString, ISODateString } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** ตัด ISO string ของ @db.Date ให้เหลือ "YYYY-MM-DD" (ไม่แปลง timezone) */
export function toDateKey(iso: ISODateString): string {
  return iso.slice(0, 10);
}

/**
 * วันนี้ตามเวลาเครื่องผู้ใช้ เป็น "YYYY-MM-DD"
 * (prototype ใช้ toISOString() ซึ่งเป็น UTC — ในไทยก่อน 07:00 น. จะได้วันที่ของเมื่อวาน)
 */
export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Decimal string จาก API → number (null/undefined → null) */
export function toNumber(value: DecimalString | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

const moneyFormatter = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });

/** แสดงเงินบาทแบบเดียวกับ prototype เช่น ฿5,906.71 */
export function formatMoney(amount: number | DecimalString | null | undefined): string {
  return moneyFormatter.format(toNumber(amount) ?? 0);
}

/** ชั่วโมงทศนิยม 1 ตำแหน่งแบบ prototype เช่น 8.0 */
export function formatHours(hours: number): string {
  return hours.toFixed(1);
}

// ─── รหัสพนักงาน ───────────────────────────────────────────

interface WorkerCodeFields {
  empId?: string | null;
}

/**
 * รหัสที่แสดงคู่ชื่อคนงาน = Employee ID ฝั่ง client (เช่น 38561733) เท่านั้น
 * ไม่ใช้ empCode (EXPT-001) แทน — คนที่ MMS ยังไม่มี Employee ID หรือสร้างใน PTA เองจะได้ null (แสดงแค่ชื่อ)
 */
export function workerCode(w: WorkerCodeFields): string | null {
  return w.empId?.trim() || null;
}

/** "ชื่อ (รหัส)" สำหรับ dropdown และตาราง เช่น "Nikorn Manget (38561733)" */
export function workerLabel(w: WorkerCodeFields & { name: string }): string {
  const code = workerCode(w);
  return code ? `${w.name} (${code})` : w.name;
}
