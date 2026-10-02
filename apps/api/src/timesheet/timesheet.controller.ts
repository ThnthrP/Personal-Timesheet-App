import {
    Controller,
    Get,
    Post,
    Patch,
    Body,
    Param,
    Req,
    UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TimesheetService } from './timesheet.service';
import { CreateTimesheetDto } from './dto/create-timesheet.dto';
import { RejectTimesheetDto } from './dto/reject-timesheet.dto';

interface AuthenticatedRequest extends Request {
    user: { userId: string; email: string; role: Role };
}

@UseGuards(JwtAuthGuard)
@Controller('timesheets')
export class TimesheetController {
    constructor(private timesheetService: TimesheetService) { }

    @Post()
    create(@Body() dto: CreateTimesheetDto, @Req() req: AuthenticatedRequest) {
        return this.timesheetService.create(req.user.userId, req.user.role, dto);
    }

    @Get()
    findAll(@Req() req: AuthenticatedRequest) {
        return this.timesheetService.findAll(req.user.userId, req.user.role);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
        return this.timesheetService.findOne(id, req.user.userId, req.user.role);
    }

    @UseGuards(RolesGuard)
    @Roles(Role.PM, Role.ADMIN)
    @Patch(':id/approve')
    approve(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
        return this.timesheetService.approve(id, req.user.userId);
    }

    @UseGuards(RolesGuard)
    @Roles(Role.PM, Role.ADMIN)
    @Patch(':id/reject')
    reject(
        @Param('id') id: string,
        @Body() dto: RejectTimesheetDto,
        @Req() req: AuthenticatedRequest,
    ) {
        return this.timesheetService.reject(id, req.user.userId, dto.reason);
    }

    @Patch(':id/resubmit')
    resubmit(
        @Param('id') id: string,
        @Body() dto: CreateTimesheetDto,
        @Req() req: AuthenticatedRequest,
    ) {
        return this.timesheetService.resubmit(id, req.user.userId, req.user.role, dto);
    }
}