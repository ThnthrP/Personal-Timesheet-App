import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWorkerDto } from './dto/create-worker.dto';

@Injectable()
export class WorkerService {
    constructor(private prisma: PrismaService) { }

    findAll() {
        return this.prisma.worker.findMany({
            include: { defaultTrade: true },
            orderBy: { name: 'asc' },
        });
    }

    create(dto: CreateWorkerDto) {
        return this.prisma.worker.create({ data: dto });
    }

    async toggleActive(id: string, active: boolean) {
        const worker = await this.prisma.worker.findUnique({ where: { id } });
        if (!worker) throw new NotFoundException('Worker not found.');
        return this.prisma.worker.update({ where: { id }, data: { active } });
    }
}