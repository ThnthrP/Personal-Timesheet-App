import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const { USER_EMAIL: email, USER_PASSWORD: password, USER_NAME: name, USER_ROLE: role } = process.env;
    if (!email || !password || !name || !role) throw new Error('ต้องตั้ง USER_EMAIL, USER_PASSWORD, USER_NAME, USER_ROLE');
    if (!(role in Role)) throw new Error(`USER_ROLE ต้องเป็น ${Object.keys(Role).join(' / ')}`);
    if (password.length < 12) throw new Error('รหัสผ่านต้องยาวอย่างน้อย 12 ตัว');

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.upsert({
        where: { email },
        update: { passwordHash, name, role: role as Role, active: true },
        create: { email, passwordHash, name, role: role as Role, active: true },
    });
    console.log(`พร้อมใช้: ${email} (${role})`);
}

main()
    .catch((e) => { console.error(e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());