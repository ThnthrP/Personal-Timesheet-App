import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TimesheetModule } from './timesheet/timesheet.module';
import { AdminModule } from './admin/admin.module';
import { WorkerContractModule } from './worker-contract/worker-contract.module';
import { PayrollModule } from './payroll/payroll.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    TimesheetModule,
    AdminModule,
    WorkerContractModule,
    PayrollModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }