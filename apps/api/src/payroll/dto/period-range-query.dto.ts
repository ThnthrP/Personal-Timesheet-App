import { IsDateString } from 'class-validator';

export class PeriodRangeQueryDto {
    @IsDateString()
    from: string;

    @IsDateString()
    to: string;
}