import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TimesheetService } from './timesheet.service';
import { TimesheetController } from './timesheet.controller';

@Module({
    imports: [AuthModule],
    controllers: [TimesheetController],
    providers: [TimesheetService],
})
export class TimesheetModule { }