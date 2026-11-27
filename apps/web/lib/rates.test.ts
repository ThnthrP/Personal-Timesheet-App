import { describe, expect, it } from 'vitest';
import { buildRateResolver, calcLineCost } from './rates';
import type { WorkerContract } from './types';

// สร้างสัญญาจ้างแบบย่อ — ใส่เฉพาะ field ที่ buildRateResolver ใช้
const contract = (c: Partial<WorkerContract>): WorkerContract =>
  ({ workerId: 'w1', tradeId: 't1', active: true, endDate: null, ...c }) as WorkerContract;

describe('buildRateResolver', () => {
  const resolve = buildRateResolver([
    contract({ id: 'old', hourlyRate: '150.00', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-06-30T00:00:00.000Z' }),
    contract({ id: 'new', hourlyRate: '180.00', startDate: '2026-07-01T00:00:00.000Z' }),
    contract({ id: 'off', hourlyRate: '999.00', startDate: '2026-08-01T00:00:00.000Z', active: false }),
    contract({ id: 'other', hourlyRate: '200.00', startDate: '2026-01-01T00:00:00.000Z', tradeId: 't2' }),
  ]);

  it('ใช้อัตราของสัญญาที่ครอบคลุมวันที่ทำงาน', () => {
    expect(resolve('w1', 't1', '2026-03-15')).toBe(150);
    expect(resolve('w1', 't1', '2026-07-15')).toBe(180);
  });

  it('วันสุดท้ายของสัญญายังนับว่าครอบคลุม', () => {
    expect(resolve('w1', 't1', '2026-06-30')).toBe(150);
  });

  it('ไม่สนใจสัญญาที่ปิดใช้งาน (active = false)', () => {
    expect(resolve('w1', 't1', '2026-08-15')).toBe(180);
  });

  it('แยกอัตราตามตำแหน่ง (trade)', () => {
    expect(resolve('w1', 't2', '2026-03-15')).toBe(200);
  });

  it('ก่อนเริ่มสัญญาแรก หรือคนที่ไม่มีสัญญา → null', () => {
    expect(resolve('w1', 't1', '2025-12-31')).toBeNull();
    expect(resolve('w9', 't1', '2026-03-15')).toBeNull();
  });

  it('สัญญาซ้อนกัน → ใช้ตัวที่เริ่มล่าสุด', () => {
    const overlap = buildRateResolver([
      contract({ hourlyRate: '150.00', startDate: '2026-01-01T00:00:00.000Z' }),
      contract({ hourlyRate: '170.00', startDate: '2026-05-01T00:00:00.000Z' }),
    ]);
    expect(overlap('w1', 't1', '2026-06-01')).toBe(170);
  });
});

describe('calcLineCost', () => {
  it('ST ×1.0 + OT1 ×1.5 + OT2 ×2.0', () => {
    expect(calcLineCost(100, 8, 2, 0)).toBe(1100); // 800 + 300
    expect(calcLineCost(100, 0, 0, 8)).toBe(1600);
  });

  it('ปัดเป็นทศนิยม 2 ตำแหน่ง', () => {
    expect(calcLineCost(187.33, 1, 0.5, 0)).toBe(327.83); // 187.33 + 140.4975
  });
});
