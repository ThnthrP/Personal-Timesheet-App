import { IsUUID, IsNumber, Min, IsDateString, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWorkerContractDto {
    @IsUUID()
    workerId: string;

    @IsUUID()
    tradeId: string;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    hourlyRate: number;

    @IsDateString()
    startDate: string;

    @IsOptional()
    @IsDateString()
    endDate?: string; // ไม่ใส่ = open-ended (ยังมีผลอยู่ไม่มีวันหมด)

    @IsOptional()
    @IsBoolean()
    allowOverlap?: boolean; // true = ยืนยันบันทึกทั้งที่รู้ว่าซ้อนทับกับสัญญาเดิม
}