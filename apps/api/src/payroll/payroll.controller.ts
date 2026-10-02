import { Controller, Get, Post, Body, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PayrollService } from './payroll.service';
import { PeriodRangeQueryDto } from './dto/period-range-query.dto';
import { SignOffPeriodDto } from './dto/sign-off-period.dto';
import { RejectPeriodDto } from './dto/reject-period.dto';

interface AuthenticatedRequest {
    user: { userId: string; email: string; role: Role };
}

@UseGuards(JwtAuthGuard)
@Controller('payroll')
export class PayrollController {
    constructor(private payrollService: PayrollService) { }

    // Exec ดูยอดรวมก่อนตัดสินใจ sign-off/reject (ยังไม่บันทึกอะไร)
    @UseGuards(RolesGuard)
    @Roles(Role.EXEC, Role.ADMIN)
    @Get('preview')
    preview(@Query() query: PeriodRangeQueryDto) {
        return this.payrollService.preview(query.from, query.to);
    }

    @UseGuards(RolesGuard)
    @Roles(Role.EXEC, Role.ADMIN)
    @Post('period-approvals/sign-off')
    signOff(@Body() dto: SignOffPeriodDto, @Req() req: AuthenticatedRequest) {
        return this.payrollService.signOffPeriod(dto.periodStart, dto.periodEnd, req.user.userId);
    }

    @UseGuards(RolesGuard)
    @Roles(Role.EXEC, Role.ADMIN)
    @Post('period-approvals/reject')
    reject(@Body() dto: RejectPeriodDto, @Req() req: AuthenticatedRequest) {
        return this.payrollService.rejectPeriod(
            dto.periodStart,
            dto.periodEnd,
            req.user.userId,
            dto.reason,
        );
    }

    // ทุก role ที่ login แล้วดูประวัติ sign-off ได้ (PM อยากเห็นว่า timesheet ของตัวเองถูก sign-off รึยัง)
    @Get('period-approvals')
    findAllPeriodApprovals() {
        return this.payrollService.findAllPeriodApprovals();
    }

    // Accounting ออกรายงานจริง — ถูก gate ด้วย Period Sign-off เสมอ
    @UseGuards(RolesGuard)
    @Roles(Role.ACCOUNTING, Role.ADMIN)
    @Get('report')
    getReport(@Query() query: PeriodRangeQueryDto) {
        return this.payrollService.getPayrollReport(query.from, query.to);
    }
}