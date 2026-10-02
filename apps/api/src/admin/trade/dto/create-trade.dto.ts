import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTradeDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    suggestedRate?: number;
}