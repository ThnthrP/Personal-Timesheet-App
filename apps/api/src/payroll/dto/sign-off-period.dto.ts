import { IsDateString } from 'class-validator';

export class SignOffPeriodDto {
    @IsDateString()
    periodStart: string;

    @IsDateString()
    periodEnd: string;
}