import {
    IsUUID,
    IsOptional,
    IsString,
    IsDateString,
    IsArray,
    ArrayMinSize,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTimesheetEntryDto } from './create-timesheet-entry.dto';

export class CreateTimesheetDto {
    @IsUUID()
    projectId: string;

    @IsOptional()
    @IsString()
    jobCode?: string;

    @IsDateString()
    date: string; // "2026-07-30"

    @IsOptional()
    @IsString()
    notes?: string;

    @IsArray()
    @ArrayMinSize(1, { message: 'ต้องมีคนงานอย่างน้อย 1 คนในใบ timesheet' })
    @ValidateNested({ each: true })
    @Type(() => CreateTimesheetEntryDto)
    entries: CreateTimesheetEntryDto[];
}