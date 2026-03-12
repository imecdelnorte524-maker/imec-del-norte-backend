// src/memory/memory.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { memoryConfig } from '../config/memory.config';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);
  private memorySnapshots: Array<{
    timestamp: Date;
    usage: NodeJS.MemoryUsage;
  }> = [];
  private peakMemory = 0;

  constructor() {
    this.startMonitoring();
  }

  private startMonitoring() {
    setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsed = Math.round(usage.heapUsed / 1024 / 1024);

      this.memorySnapshots.push({
        timestamp: new Date(),
        usage,
      });

      if (this.memorySnapshots.length > 100) {
        this.memorySnapshots.shift();
      }

      if (heapUsed > this.peakMemory) {
        this.peakMemory = heapUsed;
      }

      const heapUsagePercent = usage.heapUsed / usage.heapTotal;

      if (heapUsagePercent > memoryConfig.alerts.heapThreshold) {
        this.logger.warn(
          `⚠️ Heap alto: ${Math.round(heapUsagePercent * 100)}% (${heapUsed}MB/${Math.round(usage.heapTotal / 1024 / 1024)}MB)`,
        );
      }

      const rssMB = Math.round(usage.rss / 1024 / 1024);
      if (rssMB > 1024) {
        this.logger.error(`🔥 RSS crítico: ${rssMB}MB`);
      }
    }, memoryConfig.alerts.checkInterval);
  }

  getStats() {
    const usage = process.memoryUsage();
    return {
      current: {
        rss: Math.round(usage.rss / 1024 / 1024),
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
        external: Math.round(usage.external / 1024 / 1024),
        arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024),
      },
      peak: this.peakMemory,
      snapshots: this.memorySnapshots,
      limits: memoryConfig.limits,
    };
  }

  async forceGC() {
    if (global.gc) {
      global.gc();
      this.logger.log('🧹 Garbage collection forzado');
      return { success: true, message: 'GC ejecutado' };
    }
    return {
      success: false,
      message: 'GC no disponible (ejecutar con --expose-gc)',
    };
  }
}
