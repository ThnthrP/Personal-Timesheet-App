import { IsDateString, IsOptional, IsString } from 'class-validator';

export class RejectPeriodDto {
    @IsDateString()
    periodStart: string;

    @IsDateString()
    periodEnd: string;

    @IsOptional()
    @IsString()
    reason?: string;
}