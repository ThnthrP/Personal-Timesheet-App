import {
    BadGatewayException,
    ConflictException,
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
    ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MmsMasterData, SyncCounts, SyncSummary } from './mms-sync.types';

// ============================================================
// ดึง Trade (Position) / Worker (Employee) / Project จาก MMS มาเก็บใน pta_db
//
// MMS เป็นเจ้าของข้อมูลทั้ง 3 ชุด:
//   - รายการที่ MMS ส่งมา → สร้าง / อัปเดต / เปิด active
//   - รายการที่ไม่ได้มาจาก MMS หรือ MMS ไม่ส่งมาแล้ว → ปิด active (ไม่ลบ ประวัติ timesheet ยังอยู่)
//   - อัตราค่าจ้าง (suggestedRate, Worker Contract) ไม่แตะ — ยังเป็นของฝ่ายบัญชีใน PTA
//
// .env
//   MMS_API_URL=http://localhost:4100          ไม่ต้องมี /api ต่อท้าย
//   MMS_SERVICE_TOKEN=...                      ค่าเดียวกับ PTA_SERVICE_TOKEN ใน .env ของ MMS
//   MMS_SYNC_INTERVAL_MINUTES=60               0 = ไม่ sync อัตโนมัติ (กดปุ่มในหน้า Admin เท่านั้น)
// ไม่ตั้ง MMS_API_URL / MMS_SERVICE_TOKEN = ปิดการเชื่อม MMS (Admin เพิ่มข้อมูลเองได้เหมือนเดิม)
// ============================================================

const FETCH_TIMEOUT_MS = 30_000;
const FIRST_RUN_DELAY_MS = 30_000;

const emptyCounts = (): SyncCounts => ({ created: 0, updated: 0, deactivated: 0, unchanged: 0 });

@Injectable()
export class MmsSyncService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(MmsSyncService.name);
    private timers: NodeJS.Timeout[] = [];
    private running = false;

    constructor(private prisma: PrismaService) { }

    get configured(): boolean {
        return Boolean(process.env.MMS_API_URL?.trim() && process.env.MMS_SERVICE_TOKEN?.trim());
    }

    get intervalMinutes(): number {
        const n = Number(process.env.MMS_SYNC_INTERVAL_MINUTES ?? 60);
        return Number.isFinite(n) && n > 0 ? n : 0;
    }

    onModuleInit() {
        if (!this.configured) {
            this.logger.log('MMS sync: OFF (MMS_API_URL / MMS_SERVICE_TOKEN ไม่ได้ตั้ง)');
            return;
        }
        const minutes = this.intervalMinutes;
        this.logger.log(`MMS sync: ON · ${minutes ? `ทุก ${minutes} นาที` : 'กดจากหน้า Admin เท่านั้น'}`);
        if (minutes) {
            this.timers.push(setTimeout(() => void this.runQuietly(), FIRST_RUN_DELAY_MS));
            this.timers.push(setInterval(() => void this.runQuietly(), minutes * 60_000));
        }
    }

    onModuleDestroy() {
        this.timers.forEach((t) => clearTimeout(t));
    }

    async status() {
        const lastRun = await this.prisma.mmsSyncRun.findFirst({ orderBy: { startedAt: 'desc' } });
        return {
            configured: this.configured,
            intervalMinutes: this.intervalMinutes,
            running: this.running,
            lastRun,
        };
    }

    /** sync อัตโนมัติ — error แค่ log ไว้ ไม่ทำให้ API ล้ม */
    private async runQuietly() {
        try {
            await this.sync('auto');
        } catch (err) {
            this.logger.warn(`MMS sync (auto) ไม่สำเร็จ: ${(err as Error).message}`);
        }
    }

    async sync(trigger: 'auto' | 'manual'): Promise<SyncSummary> {
        if (!this.configured) {
            throw new ServiceUnavailableException('MMS sync is not configured (MMS_API_URL / MMS_SERVICE_TOKEN).');
        }
        if (this.running) throw new ConflictException('A sync with MMS is already running. Please wait.');

        this.running = true;
        const run = await this.prisma.mmsSyncRun.create({ data: { trigger } });
        try {
            const data = await this.fetchMasterData();
            const summary = await this.prisma.$transaction((tx) => this.apply(tx, data), { timeout: 120_000 });
            await this.prisma.mmsSyncRun.update({
                where: { id: run.id },
                data: { finishedAt: new Date(), ok: true, summary: summary as unknown as Prisma.InputJsonValue },
            });
            this.logger.log(
                `MMS sync (${trigger}) สำเร็จ · trades ${fmt(summary.trades)} · workers ${fmt(summary.workers)} · projects ${fmt(summary.projects)}`,
            );
            return summary;
        } catch (err) {
            await this.prisma.mmsSyncRun.update({
                where: { id: run.id },
                data: { finishedAt: new Date(), ok: false, error: String((err as Error).message).slice(0, 1000) },
            });
            throw err;
        } finally {
            this.running = false;
        }
    }

    private async fetchMasterData(): Promise<MmsMasterData> {
        const base = process.env.MMS_API_URL!.trim().replace(/\/+$/, '');
        const token = process.env.MMS_SERVICE_TOKEN!.trim();

        let res: Response;
        try {
            res = await fetch(`${base}/api/integration/pta/master-data`, {
                headers: { Authorization: `Bearer ${token}` },
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            });
        } catch (err) {
            throw new BadGatewayException(`Can't reach MMS at ${base}: ${(err as Error).message}`);
        }
        if (res.status === 401) throw new BadGatewayException('MMS rejected the service token (401). Check MMS_SERVICE_TOKEN.');
        if (res.status === 503) throw new BadGatewayException('MMS integration is off (503). Set PTA_SERVICE_TOKEN in the MMS .env.');
        if (!res.ok) throw new BadGatewayException(`MMS responded with HTTP ${res.status}.`);

        const data = (await res.json()) as Partial<MmsMasterData>;
        if (!Array.isArray(data.positions) || !Array.isArray(data.employees) || !Array.isArray(data.projects)) {
            throw new BadGatewayException('Unexpected response from MMS (missing positions / employees / projects).');
        }
        // กันกรณี MMS ส่งรายการว่างมาโดยไม่ตั้งใจ — ถ้าปล่อยไป ทุก Worker / Trade ใน PTA จะถูกปิด active
        if (data.employees.length === 0 || data.positions.length === 0) {
            throw new BadGatewayException('MMS returned no employees or positions — sync skipped to avoid deactivating everything.');
        }
        return data as MmsMasterData;
    }

    private async apply(tx: Prisma.TransactionClient, data: MmsMasterData): Promise<SyncSummary> {
        const summary: SyncSummary = {
            trades: emptyCounts(),
            workers: emptyCounts(),
            projects: emptyCounts(),
            workersWithoutPosition: 0,
        };

        // ── 1) Trade ← Position ──
        const trades = await tx.trade.findMany();
        const tradeByMmsId = new Map(trades.filter((t) => t.mmsPositionId).map((t) => [t.mmsPositionId!, t]));
        const tradeByName = new Map(trades.map((t) => [t.name.trim().toLowerCase(), t]));
        const tradeIdByPositionId = new Map<string, string>();
        const keptTradeIds = new Set<string>();

        for (const pos of data.positions) {
            const name = pos.name?.trim();
            if (!pos.id || !name) continue;
            const sameName = tradeByName.get(name.toLowerCase());
            // ผูกกับ Trade เดิมที่ชื่อตรงกันได้ ถ้า Trade นั้นยังไม่ได้ผูกกับ Position อื่น
            const existing = tradeByMmsId.get(pos.id) ?? (sameName && !sameName.mmsPositionId ? sameName : undefined);

            if (existing) {
                // เปลี่ยนชื่อตาม MMS เฉพาะเมื่อไม่ชนกับ Trade อื่น (name เป็น @unique)
                const nameFree = !sameName || sameName.id === existing.id;
                const data_ = {
                    mmsPositionId: pos.id,
                    active: true,
                    ...(nameFree && existing.name !== name ? { name } : {}),
                };
                if (existing.mmsPositionId !== pos.id || !existing.active || 'name' in data_) {
                    await tx.trade.update({ where: { id: existing.id }, data: data_ });
                    summary.trades.updated++;
                } else {
                    summary.trades.unchanged++;
                }
                tradeIdByPositionId.set(pos.id, existing.id);
                keptTradeIds.add(existing.id);
            } else if (!sameName) {
                const created = await tx.trade.create({ data: { name, mmsPositionId: pos.id, active: true } });
                tradeIdByPositionId.set(pos.id, created.id);
                keptTradeIds.add(created.id);
                summary.trades.created++;
            }
            // ชื่อชนกับ Trade ที่ผูกกับ Position อื่นอยู่แล้ว — ข้าม (ไม่ควรเกิด เพราะชื่อ Position ใน MMS ไม่ซ้ำกัน)
        }
        const tradeOff = await tx.trade.updateMany({
            where: { active: true, id: { notIn: [...keptTradeIds] } },
            data: { active: false },
        });
        summary.trades.deactivated = tradeOff.count;

        // ── 2) Worker ← Employee (active) ──
        const workers = await tx.worker.findMany({ where: { mmsEmployeeId: { not: null } } });
        const workerByMmsId = new Map(workers.map((w) => [w.mmsEmployeeId!, w]));
        const keptWorkerIds = new Set<string>();

        for (const emp of data.employees) {
            const name = emp.name?.trim();
            if (!emp.id || !name) continue;
            const defaultTradeId = (emp.positionId && tradeIdByPositionId.get(emp.positionId)) || null;
            if (!defaultTradeId) summary.workersWithoutPosition++;
            const empCode = emp.empCode?.trim() || null;
            // รหัสพนักงานฝั่ง client (เช่น 38561733) — บางคนใน MMS ยังไม่มี จึงเป็น null ได้
            const empId = emp.empId?.trim() || null;

            const existing = workerByMmsId.get(emp.id);
            if (existing) {
                const changed =
                    existing.name !== name ||
                    existing.empCode !== empCode ||
                    existing.empId !== empId ||
                    existing.defaultTradeId !== defaultTradeId ||
                    !existing.active;
                if (changed) {
                    await tx.worker.update({
                        where: { id: existing.id },
                        data: { name, empCode, empId, defaultTradeId, active: true },
                    });
                    summary.workers.updated++;
                } else {
                    summary.workers.unchanged++;
                }
                keptWorkerIds.add(existing.id);
            } else {
                const created = await tx.worker.create({
                    data: { name, empCode, empId, defaultTradeId, mmsEmployeeId: emp.id, active: true },
                });
                keptWorkerIds.add(created.id);
                summary.workers.created++;
            }
        }
        const workerOff = await tx.worker.updateMany({
            where: { active: true, id: { notIn: [...keptWorkerIds] } },
            data: { active: false },
        });
        summary.workers.deactivated = workerOff.count;

        // ── 3) Project ← Project ที่มีรหัส ON (จับคู่ด้วย code) ──
        const projects = await tx.project.findMany();
        const projectByCode = new Map(projects.map((p) => [p.code.trim().toUpperCase(), p]));
        const keptProjectIds = new Set<string>();

        for (const proj of data.projects) {
            const code = proj.code?.trim().toUpperCase();
            const name = proj.name?.trim() || code;
            if (!code) continue;

            const existing = projectByCode.get(code);
            if (existing) {
                if (existing.name !== name || !existing.active || !existing.fromMms) {
                    await tx.project.update({ where: { id: existing.id }, data: { name, active: true, fromMms: true } });
                    summary.projects.updated++;
                } else {
                    summary.projects.unchanged++;
                }
                keptProjectIds.add(existing.id);
            } else {
                const created = await tx.project.create({ data: { code, name, active: true, fromMms: true } });
                projectByCode.set(code, created);
                keptProjectIds.add(created.id);
                summary.projects.created++;
            }
        }
        const projectOff = await tx.project.updateMany({
            where: { active: true, id: { notIn: [...keptProjectIds] } },
            data: { active: false },
        });
        summary.projects.deactivated = projectOff.count;

        return summary;
    }
}

function fmt(c: SyncCounts) {
    return `+${c.created} ~${c.updated} -${c.deactivated}`;
}
