import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
    ) { }

    async validateUser(email: string, password: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });

        if (!user) {
            throw new UnauthorizedException('Incorrect email or password.');
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) {
            throw new UnauthorizedException('Incorrect email or password.');
        }

        if (!user.active) {
            throw new ForbiddenException('This account has been deactivated.');
        }

        return user;
    }

    async login(email: string, password: string) {
        const user = await this.validateUser(email, password);

        // role อาจเป็น null ได้ (สถานะ "Account Pending Setup" เหมือนใน prototype)
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
        };

        const accessToken = this.jwtService.sign(payload);

        return {
            accessToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
        };
    }

    async getCurrentUser(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.active) throw new UnauthorizedException('User not found.');
        return { id: user.id, email: user.email, name: user.name, role: user.role };
    }
}