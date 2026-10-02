import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { TradeService } from './trade.service';
import { CreateTradeDto } from './dto/create-trade.dto';
import { ToggleActiveDto } from '../dto/toggle-active.dto';

@UseGuards(JwtAuthGuard)
@Controller('trades')
export class TradeController {
    constructor(private tradeService: TradeService) { }

    @Get()
    findAll() {
        return this.tradeService.findAll();
    }

    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    @Post()
    create(@Body() dto: CreateTradeDto) {
        return this.tradeService.create(dto);
    }

    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    @Patch(':id/active')
    toggleActive(@Param('id') id: string, @Body() dto: ToggleActiveDto) {
        return this.tradeService.toggleActive(id, dto.active);
    }
}