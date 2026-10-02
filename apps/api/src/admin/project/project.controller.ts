import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { ToggleActiveDto } from '../dto/toggle-active.dto';

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectController {
    constructor(private projectService: ProjectService) { }

    @Get()
    findAll() {
        return this.projectService.findAll();
    }

    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    @Post()
    create(@Body() dto: CreateProjectDto) {
        return this.projectService.create(dto);
    }

    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    @Patch(':id/active')
    toggleActive(@Param('id') id: string, @Body() dto: ToggleActiveDto) {
        return this.projectService.toggleActive(id, dto.active);
    }
}