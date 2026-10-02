import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkerContractDto } from './dto/create-worker-contract.dto';

// ใช้แทนค่า "ไม่มีวันหมดอายุ" เวลาเปรียบเทียบช่วงวันที่ — เทียบง่ายกว่าการจัดการ null พิเศษทุกจุด
const FAR_FUTURE = new Date('9999-12-31T00:00:00.000Z');

@Injectable()
export class WorkerContractService {
    constructor(private prisma: PrismaService) { }

    findAll() {
        return this.prisma.workerContract.findMany({
            include: { worker: true, trade: true },
            orderBy: [{ worker: { name: 'asc' } }, { startDate: 'desc' }],
        });
    }

    /**
     * หาสัญญาที่ยัง active และช่วงวันที่ซ้อนทับกับ [startDate, endDate] ที่กำลังจะบันทึก
     * (worker + trade เดียวกันเท่านั้น) — สองช่วงซ้อนทับกันเมื่อ
     * existing.startDate <= newEnd AND newStartDate <= existing.endDate
     */
    private findOverlapping(
        workerId: string,
        tradeId: string,
        startDate: Date,
        endDate: Date | null,
        excludeContractId?: string,
    ) {
        const newEnd = endDate ?? FAR_FUTURE;
        return this.prisma.workerContract.findMany({
            where: {
                workerId,
                tradeId,
                active: true,
                ...(excludeContractId ? { id: { not: excludeContractId } } : {}),
                startDate: { lte: newEnd },
                OR: [{ endDate: null }, { endDate: { gte: startDate } }],
            },
            orderBy: { startDate: 'asc' },
        });
    }

    async create(dto: CreateWorkerContractDto) {
        const worker = await this.prisma.worker.findUnique({ where: { id: dto.workerId } });
        if (!worker || !worker.active) {
            throw new BadRequestException('Worker not found or inactive.');
        }

        const trade = await this.prisma.trade.findUnique({ where: { id: dto.tradeId } });
        if (!trade || !trade.active) {
            throw new BadRequestException('Trade not found or inactive.');
        }

        const startDate = new Date(`${dto.startDate}T00:00:00.000Z`);
        const endDate = dto.endDate ? new Date(`${dto.endDate}T00:00:00.000Z`) : null;

        if (endDate && endDate < startDate) {
            throw new BadRequestException('End Date must be on or after Start Date.');
        }

        const overlaps = await this.findOverlapping(dto.workerId, dto.tradeId, startDate, endDate);
        if (overlaps.length > 0 && !dto.allowOverlap) {
            throw new ConflictException({
                message: `This overlaps with ${overlaps.length} existing contract(s) for this worker + position. For any date both cover, the contract with the later Start Date wins — that may not be what you intend. Resend with "allowOverlap": true to proceed anyway.`,
                overlaps: overlaps.map((c) => ({
                    id: c.id,
                    startDate: c.startDate,
                    endDate: c.endDate,
                    hourlyRate: c.hourlyRate,
                })),
            });
        }

        return this.prisma.workerContract.create({
            data: {
                workerId: dto.workerId,
                tradeId: dto.tradeId,
                hourlyRate: dto.hourlyRate,
                startDate,
                endDate,
                active: true,
            },
            include: { worker: true, trade: true },
        });
    }

    async toggleActive(id: string, active: boolean) {
        const contract = await this.prisma.workerContract.findUnique({ where: { id } });
        if (!contract) throw new NotFoundException('Worker contract not found.');
        return this.prisma.workerContract.update({
            where: { id },
            data: { active },
            include: { worker: true, trade: true },
        });
    }

    /**
     * หาอัตราค่าจ้างของ worker + trade ณ วันที่กำหนด — ใช้โดย Payroll Module ในขั้นถัดไป
     * (และ Timesheet review ถ้าต้องการโชว์ estimated cost ทีหลัง)
     *
     * กติกา: หาสัญญาที่ active, ครอบคลุมวันที่นั้น (startDate <= date <= endDate หรือ endDate เป็น null)
     * ถ้ามีมากกว่า 1 สัญญาตรงกัน (ซึ่งไม่ควรเกิดถ้า validate ตอนสร้างดีพอ แต่เผื่อไว้)
     * ใช้ตัวที่ startDate ล่าสุดเป็นหลัก — ตรงกับ prototype เดิม
     */
    async resolveRate(
        workerId: string,
        tradeId: string,
        date: Date,
    ): Promise<{ contractId: string; hourlyRate: number } | null> {
        const matches = await this.prisma.workerContract.findMany({
            where: {
                workerId,
                tradeId,
                active: true,
                startDate: { lte: date },
                OR: [{ endDate: null }, { endDate: { gte: date } }],
            },
            orderBy: { startDate: 'desc' },
            take: 1,
        });

        if (matches.length === 0) return null;
        return {
            contractId: matches[0].id,
            hourlyRate: Number(matches[0].hourlyRate),
        };
    }
}