import { describe, expect, it } from 'vitest';
import { formatHours, toDateKey, toNumber, workerLabel } from './format';

describe('toDateKey', () => {
  it('ตัด ISO string เหลือ YYYY-MM-DD โดยไม่แปลง timezone', () => {
    expect(toDateKey('2026-08-03T00:00:00.000Z')).toBe('2026-08-03');
  });
});

describe('toNumber', () => {
  it('Decimal string จาก API → number', () => {
    expect(toNumber('187.50')).toBe(187.5);
    expect(toNumber(42)).toBe(42);
  });
  it('ค่าว่างหรือแปลงไม่ได้ → null', () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber('')).toBeNull();
    expect(toNumber('abc')).toBeNull();
  });
});

describe('formatHours', () => {
  it('ทศนิยม 1 ตำแหน่ง', () => {
    expect(formatHours(8)).toBe('8.0');
    expect(formatHours(2.25)).toBe('2.3');
  });
});

describe('workerLabel', () => {
  it('มี Employee ID → "ชื่อ (รหัส)"', () => {
    expect(workerLabel({ name: 'Somchai', empId: '38561733' })).toBe('Somchai (38561733)');
  });
  it('ไม่มี Employee ID หรือเป็นช่องว่าง → แสดงแค่ชื่อ', () => {
    expect(workerLabel({ name: 'Somchai', empId: null })).toBe('Somchai');
    expect(workerLabel({ name: 'Somchai', empId: '  ' })).toBe('Somchai');
  });
});
