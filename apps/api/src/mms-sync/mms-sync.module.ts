import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MmsSyncController } from './mms-sync.controller';
import { MmsSyncService } from './mms-sync.service';

@Module({
    imports: [AuthModule], // สำหรับ JwtAuthGuard (เหมือน AdminModule)
    controllers: [MmsSyncController],
    providers: [MmsSyncService],
})
export class MmsSyncModule { }
