import { Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { MmsSyncService } from './mms-sync.service';

@UseGuards(JwtAuthGuard)
@Controller('mms-sync')
export class MmsSyncController {
    constructor(private mmsSync: MmsSyncService) { }

    /** ทุก role ดูได้ — หน้า Admin ใช้ตัดสินว่าจะซ่อนฟอร์มเพิ่ม Trade / Worker / Project หรือไม่ */
    @Get('status')
    status() {
        return this.mmsSync.status();
    }

    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    @Post('run')
    @HttpCode(200)
    run() {
        return this.mmsSync.sync('manual');
    }
}
