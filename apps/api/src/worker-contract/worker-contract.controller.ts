import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WorkerContractService } from './worker-contract.service';
import { CreateWorkerContractDto } from './dto/create-worker-contract.dto';
import { ToggleActiveDto } from './dto/toggle-active.dto';

@UseGuards(JwtAuthGuard)
@Controller('worker-contracts')
export class WorkerContractController {
    constructor(private workerContractService: WorkerContractService) { }

    @Get()
    findAll() {
        return this.workerContractService.findAll();
    }

    @UseGuards(RolesGuard)
    @Roles(Role.ACCOUNTING, Role.ADMIN)
    @Post()
    create(@Body() dto: CreateWorkerContractDto) {
        return this.workerContractService.create(dto);
    }

    @UseGuards(RolesGuard)
    @Roles(Role.ACCOUNTING, Role.ADMIN)
    @Patch(':id/active')
    toggleActive(@Param('id') id: string, @Body() dto: ToggleActiveDto) {
        return this.workerContractService.toggleActive(id, dto.active);
    }
}