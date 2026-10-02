import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTradeDto } from './dto/create-trade.dto';

@Injectable()
export class TradeService {
    constructor(private prisma: PrismaService) { }

    findAll() {
        return this.prisma.trade.findMany({ orderBy: { name: 'asc' } });
    }

    async create(dto: CreateTradeDto) {
        const existing = await this.prisma.trade.findUnique({ where: { name: dto.name } });
        if (existing) {
            throw new BadRequestException(`Trade "${dto.name}" already exists.`);
        }
        return this.prisma.trade.create({ data: dto });
    }

    async toggleActive(id: string, active: boolean) {
        const trade = await this.prisma.trade.findUnique({ where: { id } });
        if (!trade) throw new NotFoundException('Trade not found.');
        return this.prisma.trade.update({ where: { id }, data: { active } });
    }
}