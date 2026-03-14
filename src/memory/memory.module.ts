// src/memory/memory.module.ts
import { Module, Global } from '@nestjs/common';
import { MemoryMonitorInterceptor } from '../common/interceptors/memory-monitor.interceptor';
import { MemoryService } from './memory.service';
import { MemoryController } from './memory.controller';

@Global()
@Module({
  providers: [
    MemoryMonitorInterceptor,
    MemoryService,
  ],
  controllers: [MemoryController],
  exports: [MemoryMonitorInterceptor, MemoryService],
})
export class MemoryModule {}
