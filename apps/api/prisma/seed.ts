import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const users = [
    { email: 'admin@ufobuildtrack.test', password: 'Adm-9273-Kx', name: 'System Admin', role: Role.ADMIN },
    { email: 'foreman@ufobuildtrack.test', password: 'For-4471-Qz', name: 'Mike Supervisor', role: Role.FOREMAN },
    { email: 'pm@ufobuildtrack.test', password: 'Pmg-8134-Rt', name: 'Sarah Manager', role: Role.PM },
    { email: 'exec@ufobuildtrack.test', password: 'Exc-6620-Lw', name: 'Robert Exec', role: Role.EXEC },
    { email: 'accounting@ufobuildtrack.test', password: 'Acc-3391-Zp', name: 'Amy Accountant', role: Role.ACCOUNTING },
];

const projects = [
    { code: 'ON/037-01/2026', name: 'Site A — Main Building' },
    { code: 'ON/145-03/2026', name: 'Site B — Warehouse Extension' },
];

const trades = [
    { name: 'Helper', suggestedRate: 80 },
    { name: 'Fitter B', suggestedRate: 100 },
    { name: 'Lead Man', suggestedRate: 150 },
];

const workers = [
    { name: 'Auttarapon Sasitron', tradeName: 'Helper' },
    { name: 'Jessadapon Sukkhang', tradeName: 'Fitter B' },
    { name: 'Damrongsak Chailert', tradeName: 'Lead Man' },
];

async function main() {
    // ── Users ──
    for (const u of users) {
        const passwordHash = await bcrypt.hash(u.password, 10);
        await prisma.user.upsert({
            where: { email: u.email },
            update: { passwordHash, name: u.name, role: u.role, active: true },
            create: { email: u.email, passwordHash, name: u.name, role: u.role, active: true },
        });
        console.log(`Seeded user: ${u.email} (${u.role})`);
    }

    // ── Projects ──
    for (const p of projects) {
        await prisma.project.upsert({
            where: { code: p.code },
            update: { name: p.name, active: true },
            create: { code: p.code, name: p.name, active: true },
        });
        console.log(`Seeded project: ${p.code}`);
    }

    // ── Trades ──
    for (const t of trades) {
        await prisma.trade.upsert({
            where: { name: t.name },
            update: { suggestedRate: t.suggestedRate, active: true },
            create: { name: t.name, suggestedRate: t.suggestedRate, active: true },
        });
        console.log(`Seeded trade: ${t.name}`);
    }

    // ── Workers (ผูกกับ defaultTrade ที่เพิ่ง seed ไปด้านบน) ──
    for (const w of workers) {
        const trade = await prisma.trade.findUnique({ where: { name: w.tradeName } });
        const existing = await prisma.worker.findFirst({ where: { name: w.name } });
        if (existing) {
            await prisma.worker.update({
                where: { id: existing.id },
                data: { defaultTradeId: trade?.id, active: true },
            });
        } else {
            await prisma.worker.create({
                data: { name: w.name, defaultTradeId: trade?.id, active: true },
            });
        }
        console.log(`Seeded worker: ${w.name} (${w.tradeName})`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });