import { WorkerContractService } from './worker-contract.service';
import { PrismaService } from '../prisma/prisma.service';

// resolveRate(): หาอัตราค่าจ้างต่อชั่วโมงของคนงาน × ตำแหน่ง ณ วันที่ทำงาน
// ใช้ PrismaService ปลอม เพื่อทดสอบโดยไม่ต้องมีฐานข้อมูล
describe('WorkerContractService.resolveRate', () => {
    const findMany = jest.fn();
    const prisma = { workerContract: { findMany } } as unknown as PrismaService;
    const service = new WorkerContractService(prisma);
    const workDate = new Date('2026-08-03T00:00:00.000Z');

    beforeEach(() => findMany.mockReset());

    it('ค้นเฉพาะสัญญาที่ active และครอบคลุมวันที่ทำงาน แล้วเอาตัวที่เริ่มล่าสุด', async () => {
        findMany.mockResolvedValue([]);
        await service.resolveRate('w1', 't1', workDate);

        expect(findMany).toHaveBeenCalledWith({
            where: {
                workerId: 'w1',
                tradeId: 't1',
                active: true,
                startDate: { lte: workDate },
                OR: [{ endDate: null }, { endDate: { gte: workDate } }],
            },
            orderBy: { startDate: 'desc' },
            take: 1,
        });
    });

    it('พบสัญญา → คืน id และอัตราเป็น number (Prisma ส่ง Decimal มาเป็นค่าที่ไม่ใช่ number)', async () => {
        findMany.mockResolvedValue([{ id: 'c9', hourlyRate: '187.50' }]);
        await expect(service.resolveRate('w1', 't1', workDate)).resolves.toEqual({
            contractId: 'c9',
            hourlyRate: 187.5,
        });
    });

    it('ไม่พบสัญญาที่ครอบคลุมวันที่ → null (หน้ารายงานจะแสดงว่ายังไม่มีอัตรา)', async () => {
        findMany.mockResolvedValue([]);
        await expect(service.resolveRate('w1', 't1', workDate)).resolves.toBeNull();
    });
});
