import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { WorkerService } from './worker.service';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { ToggleActiveDto } from '../dto/toggle-active.dto';

@UseGuards(JwtAuthGuard)
@Controller('workers')
export class WorkerController {
    constructor(private workerService: WorkerService) { }

    @Get()
    findAll() {
        return this.workerService.findAll();
    }

    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    @Post()
    create(@Body() dto: CreateWorkerDto) {
        return this.workerService.create(dto);
    }

    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    @Patch(':id/active')
    toggleActive(@Param('id') id: string, @Body() dto: ToggleActiveDto) {
        return this.workerService.toggleActive(id, dto.active);
    }
}