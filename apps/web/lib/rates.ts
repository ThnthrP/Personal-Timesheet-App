/**
 * คิดค่าจ้างประมาณการฝั่งหน้าจอ — กติกาเดียวกับ resolveRate() ใน worker-contract.service.ts ของ backend
 * - สัญญาต้อง active และครอบคลุมวันที่ทำงาน (startDate <= date <= endDate หรือ endDate ว่าง)
 * - ถ้าตรงหลายสัญญา ใช้ตัวที่ startDate ล่าสุด
 * - ค่าจ้าง = ST x1.0 + OT1 x1.5 + OT2 x2.0
 *
 * ใช้แสดงผลเท่านั้น (Est. Cost ในหน้า Review) ยอดจริงในรายงานเงินเดือนคำนวณที่ server เสมอ
 */
import type { WorkerContract } from './types';
import { toDateKey, toNumber } from './format';

export type RateResolver = (workerId: string, tradeId: string, dateKey: string) => number | null;

export function buildRateResolver(contracts: WorkerContract[]): RateResolver {
  const byKey = new Map<string, WorkerContract[]>();
  for (const c of contracts) {
    if (!c.active) continue;
    const key = `${c.workerId}|${c.tradeId}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(c);
  }
  // เรียง startDate ล่าสุดก่อน (เทียบ "YYYY-MM-DD" เป็น string ได้ตรงลำดับวันที่)
  for (const list of byKey.values()) {
    list.sort((a, b) => toDateKey(b.startDate).localeCompare(toDateKey(a.startDate)));
  }

  return (workerId, tradeId, dateKey) => {
    const match = byKey
      .get(`${workerId}|${tradeId}`)
      ?.find((c) => toDateKey(c.startDate) <= dateKey && (!c.endDate || toDateKey(c.endDate) >= dateKey));
    return match ? toNumber(match.hourlyRate) : null;
  };
}

export function calcLineCost(rate: number, st: number, ot1: number, ot2: number): number {
  return Math.round((st * rate + ot1 * rate * 1.5 + ot2 * rate * 2.0) * 100) / 100;
}
