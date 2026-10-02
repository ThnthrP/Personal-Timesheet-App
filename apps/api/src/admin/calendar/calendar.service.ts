import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DayType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCalendarOverrideDto } from './dto/create-calendar-override.dto';

@Injectable()
export class CalendarService {
    constructor(private prisma: PrismaService) { }

    findAll() {
        return this.prisma.calendarOverride.findMany({ orderBy: { date: 'asc' } });
    }

    create(dto: CreateCalendarOverrideDto) {
        if (dto.type === DayType.STANDARD) {
            throw new BadRequestException('Override type ต้องเป็น WEEKEND หรือ HOLIDAY เท่านั้น');
        }
        const dateObj = new Date(`${dto.date}T00:00:00.000Z`);
        return this.prisma.calendarOverride.upsert({
            where: { date: dateObj },
            update: { type: dto.type, label: dto.label },
            create: { date: dateObj, type: dto.type, label: dto.label },
        });
    }

    async remove(dateString: string) {
        const dateObj = new Date(`${dateString}T00:00:00.000Z`);
        const existing = await this.prisma.calendarOverride.findUnique({ where: { date: dateObj } });
        if (!existing) throw new NotFoundException('Calendar override not found.');
        await this.prisma.calendarOverride.delete({ where: { date: dateObj } });
        return { message: 'Removed.' };
    }
}