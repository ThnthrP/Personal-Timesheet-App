import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { Role, DayType, TimesheetStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTimesheetDto } from './dto/create-timesheet.dto';
import { calculateHours, resolveDayType, toDateKey } from './timesheet-calc.util';

const ROLES_ALLOWED_TO_SUBMIT: Role[] = [Role.FOREMAN, Role.ADMIN];

const TIMESHEET_INCLUDE = {
    entries: { include: { worker: true, trade: true } },
    project: true,
    foreman: { select: { id: true, name: true, email: true } },
    reviewedBy: { select: { id: true, name: true } },
    returnedBy: { select: { id: true, name: true } },
};

@Injectable()
export class TimesheetService {
    constructor(private prisma: PrismaService) { }

    /**
     * คำนวณ dayType + ST/OT1/OT2 ของแต่ละ entry จาก DTO — ใช้ร่วมกันทั้งตอน create() และ resubmit()
     * เพื่อไม่ให้ logic การคำนวณซ้ำซ้อนกันสองที่
     */
    private async resolveDayTypeAndEntries(dto: CreateTimesheetDto) {
        const dateObj = new Date(`${dto.date}T00:00:00.000Z`);
        if (Number.isNaN(dateObj.getTime())) {
            throw new BadRequestException('Invalid date.');
        }

        const override = await this.prisma.calendarOverride.findUnique({
            where: { date: dateObj },
        });
        const overridesMap = new Map<string, DayType>();
        if (override) overridesMap.set(toDateKey(dateObj), override.type);

        const dayType = resolveDayType(dateObj, overridesMap);

        const entriesData = dto.entries.map((entry) => {
            const { st, ot1, ot2 } = calculateHours(entry.startTime, entry.endTime, dayType);
            if (st === 0 && ot1 === 0 && ot2 === 0) {
                throw new BadRequestException(
                    `Invalid time range for worker entry (start: ${entry.startTime}, end: ${entry.endTime}).`,
                );
            }
            return {
                workerId: entry.workerId,
                tradeId: entry.tradeId,
                startTime: entry.startTime,
                endTime: entry.endTime,
                st,
                ot1,
                ot2,
            };
        });

        return { dateObj, dayType, entriesData };
    }

    async create(foremanId: string, foremanRole: Role, dto: CreateTimesheetDto) {
        if (!ROLES_ALLOWED_TO_SUBMIT.includes(foremanRole)) {
            throw new ForbiddenException('Only Foreman or Admin can submit timesheets.');
        }

        const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
        if (!project || !project.active) {
            throw new BadRequestException('Project not found or inactive.');
        }

        const { dateObj, dayType, entriesData } = await this.resolveDayTypeAndEntries(dto);

        try {
            return await this.prisma.timesheet.create({
                data: {
                    foremanId,
                    projectId: dto.projectId,
                    jobCode: dto.jobCode,
                    date: dateObj,
                    dayType,
                    notes: dto.notes,
                    status: TimesheetStatus.PENDING,
                    entries: { create: entriesData },
                },
                include: TIMESHEET_INCLUDE,
            });
        } catch (err: any) {
            if (err.code === 'P2003') {
                throw new BadRequestException('One or more workerId/tradeId values do not exist.');
            }
            throw err;
        }
    }

    async findAll(userId: string, role: Role) {
        const where = role === Role.FOREMAN ? { foremanId: userId } : {};
        return this.prisma.timesheet.findMany({
            where,
            include: TIMESHEET_INCLUDE,
            orderBy: { date: 'desc' },
        });
    }

    async findOne(id: string, userId: string, role: Role) {
        const timesheet = await this.prisma.timesheet.findUnique({
            where: { id },
            include: TIMESHEET_INCLUDE,
        });
        if (!timesheet) throw new NotFoundException('Timesheet not found.');
        if (role === Role.FOREMAN && timesheet.foremanId !== userId) {
            throw new ForbiddenException('You can only view your own timesheets.');
        }
        return timesheet;
    }

    async approve(id: string, reviewerId: string) {
        await this.assertIsPending(id);
        return this.prisma.timesheet.update({
            where: { id },
            data: {
                status: TimesheetStatus.APPROVED,
                reviewedById: reviewerId,
                reviewedAt: new Date(),
                rejectReason: null,
            },
            include: TIMESHEET_INCLUDE,
        });
    }

    async reject(id: string, reviewerId: string, reason?: string) {
        await this.assertIsPending(id);
        return this.prisma.timesheet.update({
            where: { id },
            data: {
                status: TimesheetStatus.REJECTED,
                reviewedById: reviewerId,
                reviewedAt: new Date(),
                rejectReason: reason ?? null,
            },
            include: TIMESHEET_INCLUDE,
        });
    }

    /**
     * Foreman (เจ้าของเดิม) แก้ไขและส่ง timesheet ที่ถูก Reject กลับเข้าคิว PM ใหม่
     * ใช้ record เดิม (ไม่สร้างใบใหม่) — ตรงกับพฤติกรรม "Edit & Resubmit" ใน prototype
     * Admin resubmit แทนใครก็ได้ (มีสิทธิ์เทียบเท่าทุก role ตาม business rule เดิม)
     */
    async resubmit(id: string, userId: string, role: Role, dto: CreateTimesheetDto) {
        const existing = await this.prisma.timesheet.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundException('Timesheet not found.');
        }
        if (existing.status !== TimesheetStatus.REJECTED) {
            throw new BadRequestException(
                `Only REJECTED timesheets can be resubmitted — current status is ${existing.status}.`,
            );
        }
        if (role !== Role.ADMIN && existing.foremanId !== userId) {
            throw new ForbiddenException('You can only resubmit your own timesheets.');
        }

        const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
        if (!project || !project.active) {
            throw new BadRequestException('Project not found or inactive.');
        }

        const { dateObj, dayType, entriesData } = await this.resolveDayTypeAndEntries(dto);

        try {
            return await this.prisma.timesheet.update({
                where: { id },
                data: {
                    projectId: dto.projectId,
                    jobCode: dto.jobCode,
                    date: dateObj,
                    dayType,
                    notes: dto.notes,
                    status: TimesheetStatus.PENDING,
                    reviewedById: null,
                    reviewedAt: null,
                    rejectReason: null,
                    // ลบ entries เดิมทั้งหมดแล้วสร้างใหม่ตามข้อมูลที่แก้ไขมา — ทำเป็น nested write เดียว
                    // ให้ Prisma จัดการแบบ atomic ไม่ต้องเปิด $transaction เอง
                    entries: {
                        deleteMany: {},
                        create: entriesData,
                    },
                },
                include: TIMESHEET_INCLUDE,
            });
        } catch (err: any) {
            if (err.code === 'P2003') {
                throw new BadRequestException('One or more workerId/tradeId values do not exist.');
            }
            throw err;
        }
    }

    private async assertIsPending(id: string) {
        const timesheet = await this.prisma.timesheet.findUnique({ where: { id } });
        if (!timesheet) {
            throw new NotFoundException('Timesheet not found.');
        }
        if (timesheet.status !== TimesheetStatus.PENDING) {
            throw new BadRequestException(
                `Cannot review this timesheet — current status is ${timesheet.status}. Only PENDING timesheets can be approved or rejected.`,
            );
        }
        return timesheet;
    }
}