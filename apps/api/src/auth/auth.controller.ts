import {
    Controller,
    Post,
    Body,
    Res,
    Get,
    UseGuards,
    Req,
    HttpCode,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

const COOKIE_NAME = 'access_token';
const isProd = process.env.NODE_ENV === 'production';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('login')
    @HttpCode(200)
    async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
        const { accessToken, user } = await this.authService.login(dto.email, dto.password);

        res.cookie(COOKIE_NAME, accessToken, {
            httpOnly: true,
            secure: isProd, // https เท่านั้นตอน production
            sameSite: 'lax',
            maxAge: 8 * 60 * 60 * 1000, // 8 ชั่วโมง ตรงกับ JWT_EXPIRES_IN
        });

        return { user };
    }

    @Post('logout')
    @HttpCode(200)
    logout(@Res({ passthrough: true }) res: Response) {
        res.clearCookie(COOKIE_NAME);
        return { message: 'Logged out.' };
    }

    // @UseGuards(JwtAuthGuard)
    // @Get('me')
    // me(@Req() req: Request) {
    //     return { user: req.user };
    // }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    async me(@Req() req: Request) {
        const payload = req.user as { userId: string };
        const user = await this.authService.getCurrentUser(payload.userId);
        return { user };
    }
}