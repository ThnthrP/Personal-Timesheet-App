import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkerContractModule } from '../worker-contract/worker-contract.module';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';

@Module({
    imports: [AuthModule, WorkerContractModule],
    controllers: [PayrollController],
    providers: [PayrollService],
})
export class PayrollModule { }