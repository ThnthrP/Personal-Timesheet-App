import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateWorkerDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsUUID()
    defaultTradeId?: string;
}