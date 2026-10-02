/**
 * Types ของข้อมูลที่ API คืนมา (รูปแบบ JSON จริง ไม่ใช่ Prisma model ตรงๆ)
 *
 * ข้อควรจำ 2 ข้อเวลาแปลง Prisma → JSON:
 * - Decimal (suggestedRate, hourlyRate, totalCost) ถูก serialize เป็น "string" เช่น "80.00"
 *   → ต้องแปลงด้วย toNumber() ใน format.ts ก่อนคำนวณ
 * - DateTime / @db.Date ถูก serialize เป็น ISO string เช่น "2026-07-30T00:00:00.000Z"
 *   → วันที่แบบ @db.Date ให้ใช้ toDateKey() ตัดเป็น "YYYY-MM-DD" ห้ามผ่าน new Date() แล้วแสดงตาม local time
 */

export type Role = 'FOREMAN' | 'PM' | 'EXEC' | 'ACCOUNTING' | 'ADMIN';
export type TimesheetStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type DayType = 'STANDARD' | 'WEEKEND' | 'HOLIDAY';
export type PeriodStatus = 'APPROVED' | 'REJECTED';

/** Prisma Decimal ใน JSON เช่น "80.00" */
export type DecimalString = string;
/** Prisma DateTime ใน JSON เช่น "2026-07-30T00:00:00.000Z" */
export type ISODateString = string;

export interface User {
  id: string;
  email: string;
  name: string;
  /** null = login ได้แต่ยังไม่ถูกกำหนด role (หน้า "Account Pending Setup" ของ prototype) */
  role: Role | null;
}

export interface UserRef {
  id: string;
  name: string;
}

// ─── Master data ───────────────────────────────────────────

export interface Project {
  id: string;
  code: string;
  name: string;
  active: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Trade {
  id: string;
  name: string;
  suggestedRate: DecimalString | null;
  active: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Worker {
  id: string;
  name: string;
  defaultTradeId: string | null;
  /** มีเฉพาะใน GET /workers (findAll include มา) — POST และ PATCH ไม่มี */
  defaultTrade?: Trade | null;
  active: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface WorkerContract {
  id: string;
  workerId: string;
  tradeId: string;
  hourlyRate: DecimalString;
  startDate: ISODateString;
  endDate: ISODateString | null; // null = open-ended
  active: boolean;
  worker: Worker;
  trade: Trade;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface CalendarOverride {
  date: ISODateString;
  type: Exclude<DayType, 'STANDARD'>;
  label: string | null;
}

// ─── Timesheet ─────────────────────────────────────────────

export interface TimesheetEntry {
  id: string;
  timesheetId: string;
  workerId: string;
  worker: Worker;
  tradeId: string;
  trade: Trade;
  startTime: string; // "HH:MM"
  endTime: string;
  st: number;
  ot1: number;
  ot2: number;
}

/** รูปแบบตาม TIMESHEET_INCLUDE ใน timesheet.service.ts */
export interface Timesheet {
  id: string;
  foremanId: string;
  foreman: UserRef & { email: string };
  projectId: string;
  project: Project;
  jobCode: string | null;
  date: ISODateString;
  dayType: DayType;
  notes: string | null;
  status: TimesheetStatus;

  reviewedById: string | null;
  reviewedBy: UserRef | null;
  reviewedAt: ISODateString | null;
  rejectReason: string | null;

  /** ตั้งค่าเมื่อ Top Management reject ทั้ง period แล้วส่งกลับมาให้ PM */
  returnedById: string | null;
  returnedBy: UserRef | null;
  returnedAt: ISODateString | null;
  returnReason: string | null;

  createdAt: ISODateString;
  updatedAt: ISODateString;
  entries: TimesheetEntry[];
}

/** body ของ POST /timesheets และ PATCH /timesheets/:id/resubmit */
export interface CreateTimesheetInput {
  projectId: string;
  jobCode?: string;
  date: string; // "YYYY-MM-DD"
  notes?: string;
  entries: {
    workerId: string;
    tradeId: string;
    startTime: string;
    endTime: string;
  }[];
}

// ─── Worker contracts ──────────────────────────────────────

/** body ของ 409 จาก POST /worker-contracts เมื่อช่วงวันที่ทับกับสัญญาเดิม
 *  → ถามผู้ใช้ยืนยัน แล้วส่งซ้ำพร้อม allowOverlap: true */
export interface ContractOverlapError {
  message: string;
  overlaps: {
    id: string;
    startDate: ISODateString;
    endDate: ISODateString | null;
    hourlyRate: DecimalString;
  }[];
}

// ─── Period sign-off & payroll ─────────────────────────────

export interface PeriodApproval {
  id: string;
  periodStart: ISODateString;
  periodEnd: ISODateString;
  status: PeriodStatus;
  totalCost: DecimalString;
  totalHours: number;
  totalST: number;
  totalOT1: number;
  totalOT2: number;
  unpricedHours: number;
  workerCount: number;
  timesheetCount: number;
  reviewedById: string;
  /** มีเฉพาะใน GET /payroll/period-approvals (sign-off/reject ไม่ include มา) */
  reviewedBy?: UserRef;
  reviewedAt: ISODateString;
  notes: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** POST /payroll/period-approvals/reject */
export interface RejectPeriodResult {
  periodApproval: PeriodApproval;
  affectedTimesheetCount: number;
}

export interface PayrollLineItem {
  workerId: string;
  workerName: string;
  date: ISODateString;
  tradeId: string;
  tradeName: string;
  st: number;
  ot1: number;
  ot2: number;
  /** null = ยังไม่มี Worker Contract ครอบคลุมวันนั้น ("pending rate") */
  rate: number | null;
  lineCost: number | null;
}

export interface PayrollWorkerSummary {
  workerId: string;
  workerName: string;
  positions: string;
  items: PayrollLineItem[];
  st: number;
  ot1: number;
  ot2: number;
  hrs: number;
  pay: number;
  unpriced: number;
}

/** GET /payroll/preview และ GET /payroll/report (รูปแบบเดียวกัน) */
export interface PayrollAggregate {
  timesheetCount: number;
  workerCount: number;
  workerSummaries: PayrollWorkerSummary[];
  grandSt: number;
  grandOt1: number;
  grandOt2: number;
  grandPay: number;
  grandUnpriced: number;
  grandHrs: number;
}

/** body ของ 403 จาก GET /payroll/report เมื่อช่วงวันที่ยังไม่ถูก sign-off */
export interface PayrollGateError {
  message: string;
  approvedPeriods: { periodStart: ISODateString; periodEnd: ISODateString }[];
}
