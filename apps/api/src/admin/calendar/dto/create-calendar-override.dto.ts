import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { DayType } from '@prisma/client';

export class CreateCalendarOverrideDto {
    @IsDateString()
    date: string;

    @IsEnum(DayType, { message: 'type ต้องเป็น WEEKEND หรือ HOLIDAY เท่านั้น' })
    type: DayType;

    @IsOptional()
    @IsString()
    label?: string;
}