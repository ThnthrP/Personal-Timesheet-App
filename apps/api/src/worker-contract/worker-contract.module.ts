import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkerContractService } from './worker-contract.service';
import { WorkerContractController } from './worker-contract.controller';

@Module({
    imports: [AuthModule],
    controllers: [WorkerContractController],
    providers: [WorkerContractService],
    exports: [WorkerContractService], // ให้ Payroll Module เรียกใช้ resolveRate() ได้ในขั้นต่อไป
})
export class WorkerContractModule { }