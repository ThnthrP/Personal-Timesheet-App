import { IsString, Matches, IsUUID } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/; // "HH:MM" เช่น "08:00", "17:30"

export class CreateTimesheetEntryDto {
    @IsUUID()
    workerId: string;

    @IsUUID()
    tradeId: string;

    @IsString()
    @Matches(TIME_PATTERN, { message: 'startTime ต้องอยู่ในรูปแบบ HH:MM' })
    startTime: string;

    @IsString()
    @Matches(TIME_PATTERN, { message: 'endTime ต้องอยู่ในรูปแบบ HH:MM' })
    endTime: string;
}