import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { TimesheetStatus, PeriodStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkerContractService } from '../worker-contract/worker-contract.service';

interface LineItem {
    workerId: string;
    workerName: string;
    date: Date;
    tradeId: string;
    tradeName: string;
    st: number;
    ot1: number;
    ot2: number;
    rate: number | null;
    lineCost: number | null;
}

interface WorkerSummary {
    workerId: string;
    workerName: string;
    positions: string;
    items: LineItem[];
    st: number;
    ot1: number;
    ot2: number;
    hrs: number;
    pay: number;
    unpriced: number;
}

export interface PayrollAggregate {
    timesheetCount: number;
    workerCount: number;
    workerSummaries: WorkerSummary[];
    grandSt: number;
    grandOt1: number;
    grandOt2: number;
    grandPay: number;
    grandUnpriced: number;
    grandHrs: number;
}

@Injectable()
export class PayrollService {
    constructor(
        private prisma: PrismaService,
        private workerContractService: WorkerContractService,
    ) { }

    private parseDateOnly(s: string): Date {
        const d = new Date(`${s}T00:00:00.000Z`);
        if (Number.isNaN(d.getTime())) {
            throw new BadRequestException(`Invalid date: ${s}`);
        }
        return d;
    }

    /**
     * รวมยอด timesheet ที่ status = APPROVED ในช่วง [from, to] แยกตามคนงาน
     * ค่าจ้างคำนวณแบบ "live" เสมอ — resolve จาก WorkerContractService ตรงกับวันที่ทำงานจริง
     * ไม่ใช่ค่าที่ freeze ไว้ตั้งแต่ตอน submit (ตรงกับหลักการใน prototype เดิม)
     *
     * ใช้ร่วมกันทั้งตอน Preview (ก่อน sign-off), ตอน Sign-off/Reject (เก็บ snapshot ตัวเลข),
     * และตอน Generate Payroll Report (Accounting)
     */
    async aggregateApprovedByWorker(from: Date, to: Date): Promise<PayrollAggregate> {
        const timesheets = await this.prisma.timesheet.findMany({
            where: { status: TimesheetStatus.APPROVED, date: { gte: from, lte: to } },
            include: { entries: { include: { worker: true, trade: true } } },
        });

        const lineItems: LineItem[] = [];
        for (const ts of timesheets) {
            for (const entry of ts.entries) {
                const resolved = await this.workerContractService.resolveRate(
                    entry.workerId,
                    entry.tradeId,
                    ts.date,
                );
                const rate = resolved?.hourlyRate ?? null;
                const lineCost =
                    rate != null ? entry.st * rate + entry.ot1 * rate * 1.5 + entry.ot2 * rate * 2.0 : null;

                lineItems.push({
                    workerId: entry.workerId,
                    workerName: entry.worker.name,
                    date: ts.date,
                    tradeId: entry.tradeId,
                    tradeName: entry.trade.name,
                    st: entry.st,
                    ot1: entry.ot1,
                    ot2: entry.ot2,
                    rate,
                    lineCost,
                });
            }
        }

        const byWorker = new Map<string, LineItem[]>();
        for (const li of lineItems) {
            if (!byWorker.has(li.workerId)) byWorker.set(li.workerId, []);
            byWorker.get(li.workerId)!.push(li);
        }

        let grandSt = 0,
            grandOt1 = 0,
            grandOt2 = 0,
            grandPay = 0,
            grandUnpriced = 0;

        const workerSummaries: WorkerSummary[] = [...byWorker.entries()]
            .map(([workerId, items]) => {
                items.sort((a, b) => a.date.getTime() - b.date.getTime());
                let st = 0,
                    ot1 = 0,
                    ot2 = 0,
                    pay = 0,
                    unpriced = 0;
                for (const li of items) {
                    st += li.st;
                    ot1 += li.ot1;
                    ot2 += li.ot2;
                    if (li.lineCost == null) unpriced += li.st + li.ot1 + li.ot2;
                    else pay += li.lineCost;
                }
                grandSt += st;
                grandOt1 += ot1;
                grandOt2 += ot2;
                grandPay += pay;
                grandUnpriced += unpriced;

                const positions = [...new Set(items.map((i) => i.tradeName))].join(', ');
                return {
                    workerId,
                    workerName: items[0].workerName,
                    positions,
                    items,
                    st,
                    ot1,
                    ot2,
                    hrs: st + ot1 + ot2,
                    pay,
                    unpriced,
                };
            })
            .sort((a, b) => a.workerName.localeCompare(b.workerName));

        return {
            timesheetCount: timesheets.length,
            workerCount: workerSummaries.length,
            workerSummaries,
            grandSt,
            grandOt1,
            grandOt2,
            grandPay,
            grandUnpriced,
            grandHrs: grandSt + grandOt1 + grandOt2,
        };
    }

    async preview(fromStr: string, toStr: string) {
        const from = this.parseDateOnly(fromStr);
        const to = this.parseDateOnly(toStr);
        if (from > to) throw new BadRequestException('"from" must be before or equal to "to".');
        return this.aggregateApprovedByWorker(from, to);
    }

    async signOffPeriod(periodStartStr: string, periodEndStr: string, reviewerId: string) {
        const periodStart = this.parseDateOnly(periodStartStr);
        const periodEnd = this.parseDateOnly(periodEndStr);
        if (periodStart > periodEnd) {
            throw new BadRequestException('periodStart must be before or equal to periodEnd.');
        }

        const agg = await this.aggregateApprovedByWorker(periodStart, periodEnd);

        return this.prisma.periodApproval.upsert({
            where: { periodStart_periodEnd: { periodStart, periodEnd } },
            update: {
                status: PeriodStatus.APPROVED,
                totalCost: agg.grandPay,
                totalHours: agg.grandHrs,
                totalST: agg.grandSt,
                totalOT1: agg.grandOt1,
                totalOT2: agg.grandOt2,
                unpricedHours: agg.grandUnpriced,
                workerCount: agg.workerCount,
                timesheetCount: agg.timesheetCount,
                reviewedById: reviewerId,
                reviewedAt: new Date(),
                notes: null,
            },
            create: {
                periodStart,
                periodEnd,
                status: PeriodStatus.APPROVED,
                totalCost: agg.grandPay,
                totalHours: agg.grandHrs,
                totalST: agg.grandSt,
                totalOT1: agg.grandOt1,
                totalOT2: agg.grandOt2,
                unpricedHours: agg.grandUnpriced,
                workerCount: agg.workerCount,
                timesheetCount: agg.timesheetCount,
                reviewedById: reviewerId,
                reviewedAt: new Date(),
            },
        });
    }

    /**
     * ตีกลับทั้ง period — ทุก timesheet ที่ APPROVED ในช่วงนี้ถูกส่งกลับไป PENDING
     * พร้อม returnedBy/returnedAt/returnReason (คนละ field กับ reviewedBy ของ PM เดิม
     * เพื่อให้เห็นประวัติทั้งสองชั้นแยกกันชัดเจน) — ทำเป็น transaction เดียวให้ atomic
     */
    async rejectPeriod(
        periodStartStr: string,
        periodEndStr: string,
        reviewerId: string,
        reason?: string,
    ) {
        const periodStart = this.parseDateOnly(periodStartStr);
        const periodEnd = this.parseDateOnly(periodEndStr);
        if (periodStart > periodEnd) {
            throw new BadRequestException('periodStart must be before or equal to periodEnd.');
        }

        const agg = await this.aggregateApprovedByWorker(periodStart, periodEnd);

        return this.prisma.$transaction(async (tx) => {
            const { count } = await tx.timesheet.updateMany({
                where: { status: TimesheetStatus.APPROVED, date: { gte: periodStart, lte: periodEnd } },
                data: {
                    status: TimesheetStatus.PENDING,
                    returnedById: reviewerId,
                    returnedAt: new Date(),
                    returnReason: reason ?? null,
                },
            });

            const periodApproval = await tx.periodApproval.upsert({
                where: { periodStart_periodEnd: { periodStart, periodEnd } },
                update: {
                    status: PeriodStatus.REJECTED,
                    totalCost: agg.grandPay,
                    totalHours: agg.grandHrs,
                    totalST: agg.grandSt,
                    totalOT1: agg.grandOt1,
                    totalOT2: agg.grandOt2,
                    unpricedHours: agg.grandUnpriced,
                    workerCount: agg.workerCount,
                    timesheetCount: agg.timesheetCount,
                    reviewedById: reviewerId,
                    reviewedAt: new Date(),
                    notes: reason ?? null,
                },
                create: {
                    periodStart,
                    periodEnd,
                    status: PeriodStatus.REJECTED,
                    totalCost: agg.grandPay,
                    totalHours: agg.grandHrs,
                    totalST: agg.grandSt,
                    totalOT1: agg.grandOt1,
                    totalOT2: agg.grandOt2,
                    unpricedHours: agg.grandUnpriced,
                    workerCount: agg.workerCount,
                    timesheetCount: agg.timesheetCount,
                    reviewedById: reviewerId,
                    reviewedAt: new Date(),
                    notes: reason ?? null,
                },
            });

            return { periodApproval, affectedTimesheetCount: count };
        });
    }

    findAllPeriodApprovals() {
        return this.prisma.periodApproval.findMany({
            include: { reviewedBy: { select: { id: true, name: true } } },
            orderBy: { periodStart: 'desc' },
        });
    }

    /**
     * ออกรายงานเงินเดือน — ทำได้เฉพาะช่วงวันที่ที่มีการ sign-off (APPROVED) ตรงเป๊ะเท่านั้น
     * ถ้ายังไม่ได้อนุมัติ จะบล็อกพร้อมบอกว่าช่วงไหนอนุมัติไปแล้วบ้าง (ให้ frontend เสนอ shortcut ได้)
     */
    async getPayrollReport(fromStr: string, toStr: string) {
        const from = this.parseDateOnly(fromStr);
        const to = this.parseDateOnly(toStr);
        if (from > to) throw new BadRequestException('"from" must be before or equal to "to".');

        const periodApproval = await this.prisma.periodApproval.findUnique({
            where: { periodStart_periodEnd: { periodStart: from, periodEnd: to } },
        });

        if (!periodApproval || periodApproval.status !== PeriodStatus.APPROVED) {
            const approvedPeriods = await this.prisma.periodApproval.findMany({
                where: { status: PeriodStatus.APPROVED },
                orderBy: { periodStart: 'desc' },
                select: { periodStart: true, periodEnd: true },
            });
            throw new ForbiddenException({
                message:
                    "Top Management hasn't signed off on this exact date range yet. Payroll can only be generated for a period approved under Period Sign-off.",
                approvedPeriods,
            });
        }

        return this.aggregateApprovedByWorker(from, to);
    }
}