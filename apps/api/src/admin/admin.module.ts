import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectService } from './project/project.service';
import { ProjectController } from './project/project.controller';
import { TradeService } from './trade/trade.service';
import { TradeController } from './trade/trade.controller';
import { WorkerService } from './worker/worker.service';
import { WorkerController } from './worker/worker.controller';
import { CalendarService } from './calendar/calendar.service';
import { CalendarController } from './calendar/calendar.controller';

@Module({
    imports: [AuthModule], // จำเป็นสำหรับ JwtAuthGuard (เหมือนที่ทำใน TimesheetModule)
    controllers: [ProjectController, TradeController, WorkerController, CalendarController],
    providers: [ProjectService, TradeService, WorkerService, CalendarService],
})
export class AdminModule { }