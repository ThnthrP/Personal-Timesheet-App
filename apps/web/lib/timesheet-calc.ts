/**
 * สำเนาของ apps/api/src/timesheet/timesheet-calc.util.ts สำหรับแสดงผล ST/OT1/OT2 แบบ live
 * ระหว่างที่ Foreman กรอกฟอร์ม (ก่อนกด Submit)
 *
 * ตัวเลขจริงที่บันทึกคำนวณใหม่ที่ server เสมอ — ไฟล์นี้มีไว้แสดงผลเท่านั้น
 * ถ้าแก้กฎการคำนวณฝั่ง API ต้องแก้ที่นี่ด้วย (หรือย้ายไป packages/shared ในอนาคต)
 */
import type { CalendarOverride, DayType } from './types';
import { toDateKey } from './format';

export interface HoursBreakdown {
  st: number;
  ot1: number;
  ot2: number;
}

export function timeToDecimal(timeString: string | null | undefined): number {
  if (!timeString) return 0;
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours + minutes / 60;
}

/** dateKey = "YYYY-MM-DD" — override ของ Admin มาก่อน แล้วค่อยดูเสาร์/อาทิตย์ */
export function resolveDayType(dateKey: string, overrides: CalendarOverride[]): DayType {
  const override = overrides.find((o) => toDateKey(o.date) === dateKey);
  if (override) return override.type;
  const dayOfWeek = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  return dayOfWeek === 0 || dayOfWeek === 6 ? 'WEEKEND' : 'STANDARD';
}

export function calculateHours(startTime: string, endTime: string, dayType: DayType): HoursBreakdown {
  const start = timeToDecimal(startTime);
  const end = timeToDecimal(endTime);
  if (!startTime || !endTime || end <= start) return { st: 0, ot1: 0, ot2: 0 };

  let gross = end - start;
  if (gross > 5) gross -= 1; // หักพักเที่ยงแบบไม่จ่าย 1 ชม.

  let st = 0;
  let ot1 = 0;
  let ot2 = 0;
  if (dayType === 'STANDARD') {
    if (gross <= 8) st = gross;
    else {
      st = 8;
      ot1 = gross - 8;
    }
  } else {
    ot2 = gross;
  }
  const round = (v: number) => Math.round(v * 10) / 10;
  return { st: round(st), ot1: round(ot1), ot2: round(ot2) };
}
