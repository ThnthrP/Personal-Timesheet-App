import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

// สร้าง ExecutionContext ปลอม: กำหนด role ของผู้ใช้ใน request และ role ที่ route ต้องการ
function contextFor(user: { role: Role } | undefined): ExecutionContext {
    return {
        getHandler: () => () => undefined,
        getClass: () => class {},
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
    let reflector: Reflector;
    let guard: RolesGuard;

    beforeEach(() => {
        reflector = new Reflector();
        guard = new RolesGuard(reflector);
    });

    const requireRoles = (roles: Role[] | undefined) =>
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);

    it('route ไม่ได้ใส่ @Roles() → ผ่านทุกคน', () => {
        requireRoles(undefined);
        expect(guard.canActivate(contextFor({ role: Role.FOREMAN }))).toBe(true);
    });

    it('@Roles() ว่าง → ผ่านทุกคน', () => {
        requireRoles([]);
        expect(guard.canActivate(contextFor({ role: Role.FOREMAN }))).toBe(true);
    });

    it('role ของผู้ใช้อยู่ในรายการ → ผ่าน', () => {
        requireRoles([Role.PM, Role.EXEC]);
        expect(guard.canActivate(contextFor({ role: Role.PM }))).toBe(true);
    });

    it('role ของผู้ใช้ไม่อยู่ในรายการ → 403 Forbidden', () => {
        requireRoles([Role.ACCOUNTING]);
        expect(() => guard.canActivate(contextFor({ role: Role.FOREMAN }))).toThrow(ForbiddenException);
    });

    it('ไม่มีข้อมูลผู้ใช้ใน request → 403 Forbidden', () => {
        requireRoles([Role.ADMIN]);
        expect(() => guard.canActivate(contextFor(undefined))).toThrow(ForbiddenException);
    });

    it('อ่าน role จากทั้ง method และ class (method ชนะ)', () => {
        const spy = requireRoles([Role.ADMIN]);
        guard.canActivate(contextFor({ role: Role.ADMIN }));
        expect(spy).toHaveBeenCalledWith('roles', [expect.any(Function), expect.any(Function)]);
    });
});
