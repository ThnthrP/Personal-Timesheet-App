import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectService {
    constructor(private prisma: PrismaService) { }

    findAll() {
        return this.prisma.project.findMany({ orderBy: { code: 'asc' } });
    }

    async create(dto: CreateProjectDto) {
        const existing = await this.prisma.project.findUnique({ where: { code: dto.code } });
        if (existing) {
            throw new BadRequestException(`Project code "${dto.code}" already exists.`);
        }
        return this.prisma.project.create({ data: dto });
    }

    async toggleActive(id: string, active: boolean) {
        const project = await this.prisma.project.findUnique({ where: { id } });
        if (!project) throw new NotFoundException('Project not found.');
        return this.prisma.project.update({ where: { id }, data: { active } });
    }
}