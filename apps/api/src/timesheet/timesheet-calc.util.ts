import { DayType } from '@prisma/client';

/**
 * ผลลัพธ์การคำนวณชั่วโมงทำงาน — ปัดทศนิยม 1 ตำแหน่งเสมอ (เหมือน prototype เดิม)
 */
export interface HoursBreakdown {
    st: number; // Standard Time (1.0x)
    ot1: number; // Overtime 1 (1.5x) — เฉพาะวันทำงานปกติที่เกิน 8 ชม.
    ot2: number; // Overtime 2 (2.0x) — วันหยุดสุดสัปดาห์/วันหยุดบริษัท ทุกชั่วโมง
}

/**
 * แปลงเวลาแบบ "HH:MM" เป็นเลขทศนิยม (เช่น "08:30" → 8.5)
 */
export function timeToDecimal(timeString: string | null | undefined): number {
    if (!timeString) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours + minutes / 60;
}

/**
 * หาประเภทของวัน (Standard / Weekend / Holiday) จากวันที่ + calendar override ที่ Admin กำหนดไว้
 *
 * ลำดับความสำคัญ:
 * 1. ถ้ามี override ที่ตั้งไว้เฉพาะวันนั้น (Admin กำหนดเอง) ใช้ค่านั้นก่อนเสมอ
 * 2. ถ้าไม่มี override → เสาร์/อาทิตย์ = Weekend, วันอื่น = Standard
 *
 * ใช้ getUTCDay() ไม่ใช่ getDay() เพื่อไม่ให้ผลลัพธ์ขึ้นกับ timezone ของเครื่อง server
 * (Prisma เก็บ @db.Date เป็น UTC midnight เสมอ)
 */
export function resolveDayType(
    date: Date,
    overridesByDateKey: Map<string, DayType>,
): DayType {
    const dateKey = toDateKey(date);
    const override = overridesByDateKey.get(dateKey);
    if (override) return override;

    const dayOfWeek = date.getUTCDay(); // 0 = อาทิตย์, 6 = เสาร์
    if (dayOfWeek === 0 || dayOfWeek === 6) return DayType.WEEKEND;
    return DayType.STANDARD;
}

/**
 * แปลง Date เป็น key รูปแบบ "YYYY-MM-DD" สำหรับใช้ค้นหาใน Map ของ calendar overrides
 */
export function toDateKey(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * คำนวณ ST/OT1/OT2 จากเวลาเข้า-ออก และประเภทของวัน
 *
 * กฎ:
 * - หักพักเที่ยง 1 ชม. อัตโนมัติ ถ้ากะทำงานยาวเกิน 5 ชม. (เฉพาะการหักเวลาเท่านั้น
 *   ไม่เกี่ยวกับว่าเป็นวันหยุดหรือไม่ — ตรงกับ prototype เดิมที่หักก่อนเช็ค dayType)
 * - วันทำงานปกติ (STANDARD): 8 ชม.แรก = ST, ส่วนเกิน = OT1 (1.5x)
 * - วันหยุด (WEEKEND/HOLIDAY): ทุกชั่วโมงที่ทำงาน = OT2 (2.0x) ทั้งหมด ไม่มี ST/OT1
 * - ถ้าเวลาออกไม่มากกว่าเวลาเข้า (ข้อมูลผิดพลาด) → คืนค่า 0 ทั้งหมด
 */
export function calculateHours(
    startTime: string,
    endTime: string,
    dayType: DayType,
): HoursBreakdown {
    const startDecimal = timeToDecimal(startTime);
    const endDecimal = timeToDecimal(endTime);

    if (!startTime || !endTime || endDecimal <= startDecimal) {
        return { st: 0, ot1: 0, ot2: 0 };
    }

    let grossHours = endDecimal - startDecimal;
    if (grossHours > 5) {
        grossHours -= 1; // หักพักเที่ยงแบบไม่จ่าย 1 ชม.
    }

    let st = 0;
    let ot1 = 0;
    let ot2 = 0;

    if (dayType === DayType.STANDARD) {
        if (grossHours <= 8) {
            st = grossHours;
        } else {
            st = 8;
            ot1 = grossHours - 8;
        }
    } else {
        // WEEKEND หรือ HOLIDAY — ทุกชั่วโมงนับเป็น OT2
        ot2 = grossHours;
    }

    return {
        st: roundToOneDecimal(st),
        ot1: roundToOneDecimal(ot1),
        ot2: roundToOneDecimal(ot2),
    };
}

function roundToOneDecimal(value: number): number {
    return Math.round(value * 10) / 10;
}