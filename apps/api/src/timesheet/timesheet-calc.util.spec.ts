import { DayType } from '@prisma/client';
import {
    calculateHours,
    resolveDayType,
    timeToDecimal,
    toDateKey,
} from './timesheet-calc.util';

describe('timeToDecimal', () => {
    it('แปลงเวลาแบบ HH:MM เป็นทศนิยมถูกต้อง', () => {
        expect(timeToDecimal('08:00')).toBe(8);
        expect(timeToDecimal('08:30')).toBe(8.5);
        expect(timeToDecimal('17:15')).toBeCloseTo(17.25);
    });

    it('คืนค่า 0 ถ้าไม่มีเวลาให้', () => {
        expect(timeToDecimal(null)).toBe(0);
        expect(timeToDecimal(undefined)).toBe(0);
        expect(timeToDecimal('')).toBe(0);
    });
});

describe('resolveDayType', () => {
    it('วันธรรมดา (จันทร์-ศุกร์) ไม่มี override → STANDARD', () => {
        // 2026-07-30 คือวันพฤหัสบดี
        const date = new Date('2026-07-30T00:00:00.000Z');
        expect(resolveDayType(date, new Map())).toBe(DayType.STANDARD);
    });

    it('วันเสาร์ ไม่มี override → WEEKEND', () => {
        // 2026-08-01 คือวันเสาร์
        const date = new Date('2026-08-01T00:00:00.000Z');
        expect(resolveDayType(date, new Map())).toBe(DayType.WEEKEND);
    });

    it('วันอาทิตย์ ไม่มี override → WEEKEND', () => {
        // 2026-08-02 คือวันอาทิตย์
        const date = new Date('2026-08-02T00:00:00.000Z');
        expect(resolveDayType(date, new Map())).toBe(DayType.WEEKEND);
    });

    it('วันจันทร์ปกติ แต่ Admin ตั้ง override เป็น HOLIDAY → ใช้ค่า override', () => {
        // 2026-08-03 คือวันจันทร์ (ปกติควรเป็น STANDARD)
        const date = new Date('2026-08-03T00:00:00.000Z');
        const overrides = new Map([['2026-08-03', DayType.HOLIDAY]]);
        expect(resolveDayType(date, overrides)).toBe(DayType.HOLIDAY);
    });
});

describe('calculateHours', () => {
    it('ตัวอย่างที่ 1: วันปกติ กะสั้น 4 ชม. (ไม่หักพักเที่ยง)', () => {
        const result = calculateHours('08:00', '12:00', DayType.STANDARD);
        expect(result).toEqual({ st: 4, ot1: 0, ot2: 0 });
    });

    it('ตัวอย่างที่ 2: วันปกติ กะ 9 ชม. (หักพักเที่ยงเหลือ 8 ชม. = ST พอดี)', () => {
        const result = calculateHours('08:00', '17:00', DayType.STANDARD);
        expect(result).toEqual({ st: 8, ot1: 0, ot2: 0 });
    });

    it('ตัวอย่างที่ 3: วันปกติ กะ 11 ชม. (หักพักเที่ยงเหลือ 10 ชม. → ST 8 + OT1 2)', () => {
        const result = calculateHours('08:00', '19:00', DayType.STANDARD);
        expect(result).toEqual({ st: 8, ot1: 2, ot2: 0 });
    });

    it('ตัวอย่างที่ 4: วันเสาร์ กะ 9 ชม. → หักพักเที่ยง 1 ชม. เหลือ 8 ชม. ทั้งหมดเป็น OT2', () => {
        const result = calculateHours('08:00', '17:00', DayType.WEEKEND);
        expect(result).toEqual({ st: 0, ot1: 0, ot2: 8 });
    });

    it('ตัวอย่างที่ 5: วันหยุดบริษัท (HOLIDAY) กะ 6 ชม. → หักพักเที่ยง 1 ชม. เหลือ 5 ชม. ทั้งหมดเป็น OT2', () => {
        const result = calculateHours('08:00', '14:00', DayType.HOLIDAY);
        expect(result).toEqual({ st: 0, ot1: 0, ot2: 5 });
    });

    it('กะสั้นมาก ไม่เกิน 5 ชม. ในวันหยุด → ไม่หักพักเที่ยง ทั้งหมดเป็น OT2', () => {
        const result = calculateHours('08:00', '12:00', DayType.WEEKEND);
        expect(result).toEqual({ st: 0, ot1: 0, ot2: 4 });
    });

    it('เวลาออกเท่ากับหรือน้อยกว่าเวลาเข้า (ข้อมูลผิด) → คืนค่า 0 ทั้งหมด', () => {
        expect(calculateHours('17:00', '08:00', DayType.STANDARD)).toEqual({
            st: 0,
            ot1: 0,
            ot2: 0,
        });
        expect(calculateHours('08:00', '08:00', DayType.STANDARD)).toEqual({
            st: 0,
            ot1: 0,
            ot2: 0,
        });
    });

    it('ไม่มีเวลาเข้า/ออก → คืนค่า 0 ทั้งหมด', () => {
        expect(calculateHours('', '17:00', DayType.STANDARD)).toEqual({
            st: 0,
            ot1: 0,
            ot2: 0,
        });
    });

    it('กะยาวพอดี 5 ชม. เป๊ะ → ไม่หักพักเที่ยง (เงื่อนไขคือ "เกิน" 5 ชม. ไม่ใช่ "ตั้งแต่")', () => {
        const result = calculateHours('08:00', '13:00', DayType.STANDARD);
        expect(result).toEqual({ st: 5, ot1: 0, ot2: 0 });
    });

    it('กะยาว 5.5 ชม. (เกิน 5 ชม.) → หักพักเที่ยง เหลือ 4.5 ชม.', () => {
        const result = calculateHours('08:00', '13:30', DayType.STANDARD);
        expect(result).toEqual({ st: 4.5, ot1: 0, ot2: 0 });
    });

    it('ปัดทศนิยม 1 ตำแหน่งถูกต้อง', () => {
        // 08:00-17:20 = 9.333... ชม. หัก 1 = 8.333... → ST 8, OT1 0.3
        const result = calculateHours('08:00', '17:20', DayType.STANDARD);
        expect(result).toEqual({ st: 8, ot1: 0.3, ot2: 0 });
    });
});

describe('toDateKey', () => {
    it('แปลง Date เป็น key รูปแบบ YYYY-MM-DD ตาม UTC', () => {
        const date = new Date('2026-07-30T00:00:00.000Z');
        expect(toDateKey(date)).toBe('2026-07-30');
    });
});