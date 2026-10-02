import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

// ดึง JWT จาก HTTP-only cookie ชื่อ "access_token" แทนที่จะดึงจาก Authorization header
// (ตามที่วางแผนไว้ตั้งแต่ต้น — ปลอดภัยกว่า localStorage เพราะ JS ฝั่ง client อ่านไม่ได้)
const cookieExtractor = (req: Request): string | null => {
    if (req && req.cookies) {
        return req.cookies['access_token'] || null;
    }
    return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            jwtFromRequest: cookieExtractor,
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET,
        });
    }

    async validate(payload: any) {
        // สิ่งที่ return ตรงนี้จะกลายเป็น req.user ในทุก endpoint ที่ใช้ guard
        return { userId: payload.sub, email: payload.email, role: payload.role };
    }
}