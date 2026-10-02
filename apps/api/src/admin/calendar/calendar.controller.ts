import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CalendarService } from './calendar.service';
import { CreateCalendarOverrideDto } from './dto/create-calendar-override.dto';

@UseGuards(JwtAuthGuard)
@Controller('calendar-overrides')
export class CalendarController {
    constructor(private calendarService: CalendarService) { }

    @Get()
    findAll() {
        return this.calendarService.findAll();
    }

    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    @Post()
    create(@Body() dto: CreateCalendarOverrideDto) {
        return this.calendarService.create(dto);
    }

    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    @Delete(':date')
    remove(@Param('date') date: string) {
        return this.calendarService.remove(date);
    }
}