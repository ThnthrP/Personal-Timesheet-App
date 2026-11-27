import { describe, expect, it } from 'vitest';
import { calculateHours, resolveDayType, timeToDecimal } from './timesheet-calc';

// ไฟล์นี้เป็นสำเนาของกฎฝั่ง API (apps/api/src/timesheet/timesheet-calc.util.ts)
// ใช้ตัวอย่างชุดเดียวกับ test ฝั่ง API เพื่อให้ตัวเลขที่ Foreman เห็นตอนกรอกตรงกับที่ server บันทึก
describe('timeToDecimal', () => {
  it('แปลง HH:MM เป็นชั่วโมงทศนิยม', () => {
    expect(timeToDecimal('08:30')).toBe(8.5);
    expect(timeToDecimal('17:15')).toBeCloseTo(17.25);
  });
  it('ไม่มีค่า → 0', () => {
    expect(timeToDecimal('')).toBe(0);
    expect(timeToDecimal(null)).toBe(0);
  });
});

describe('resolveDayType', () => {
  it('จันทร์–ศุกร์ → STANDARD · เสาร์–อาทิตย์ → WEEKEND', () => {
    expect(resolveDayType('2026-07-30', [])).toBe('STANDARD'); // พฤหัสบดี
    expect(resolveDayType('2026-08-01', [])).toBe('WEEKEND'); // เสาร์
    expect(resolveDayType('2026-08-02', [])).toBe('WEEKEND'); // อาทิตย์
  });
  it('Admin ตั้งวันหยุดไว้ → ใช้ค่าที่ตั้ง แม้เป็นวันธรรมดา', () => {
    const overrides = [{ date: '2026-08-03T00:00:00.000Z', type: 'HOLIDAY' as const, label: 'วันหยุดบริษัท' }];
    expect(resolveDayType('2026-08-03', overrides)).toBe('HOLIDAY');
  });
});

describe('calculateHours', () => {
  it.each([
    ['วันธรรมดา 4 ชม. ไม่หักพัก', '08:00', '12:00', 'STANDARD', { st: 4, ot1: 0, ot2: 0 }],
    ['วันธรรมดา 9 ชม. หักพัก 1 = ST 8', '08:00', '17:00', 'STANDARD', { st: 8, ot1: 0, ot2: 0 }],
    ['วันธรรมดา 11 ชม. หักพัก 1 = ST 8 + OT1 2', '08:00', '19:00', 'STANDARD', { st: 8, ot1: 2, ot2: 0 }],
    ['เสาร์ 9 ชม. หักพัก 1 = OT2 8', '08:00', '17:00', 'WEEKEND', { st: 0, ot1: 0, ot2: 8 }],
    ['วันหยุด 6 ชม. หักพัก 1 = OT2 5', '08:00', '14:00', 'HOLIDAY', { st: 0, ot1: 0, ot2: 5 }],
  ] as const)('%s', (_name, start, end, dayType, expected) => {
    expect(calculateHours(start, end, dayType)).toEqual(expected);
  });

  it('เวลาเลิกไม่หลังเวลาเริ่ม หรือกรอกไม่ครบ → 0 ทั้งหมด', () => {
    expect(calculateHours('17:00', '08:00', 'STANDARD')).toEqual({ st: 0, ot1: 0, ot2: 0 });
    expect(calculateHours('', '17:00', 'STANDARD')).toEqual({ st: 0, ot1: 0, ot2: 0 });
  });
});
