// src/common/interceptors/memory-monitor.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { memoryConfig } from '../../config/memory.config';

@Injectable()
export class MemoryMonitorInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MemoryMonitorInterceptor.name);
  private peakMemory = 0;
  private requestCount = 0;

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    this.requestCount++;

    const beforeMem = process.memoryUsage();
    const url = context.switchToHttp().getRequest().url;

    return next.handle().pipe(
      tap({
        next: () => {
          const afterMem = process.memoryUsage();
          const duration = Date.now() - start;
          const heapUsed = Math.round(afterMem.heapUsed / 1024 / 1024);
          const heapDiff = Math.round(
            (afterMem.heapUsed - beforeMem.heapUsed) / 1024 / 1024,
          );

          if (heapUsed > this.peakMemory) {
            this.peakMemory = heapUsed;
          }

          // Log si consume mucha memoria
          if (heapDiff > 10) {
            this.logger.warn(
              `⚠️ Alta memoria: ${url} - ${heapDiff}MB (total: ${heapUsed}MB, peak: ${this.peakMemory}MB)`,
            );
          }

          // Verificar thresholds
          const heapUsage = afterMem.heapUsed / afterMem.heapTotal;
          if (heapUsage > memoryConfig.alerts.heapThreshold) {
            this.logger.error(
              `🔥 Heap crítico: ${Math.round(heapUsage * 100)}% - ${heapUsed}MB/${Math.round(afterMem.heapTotal / 1024 / 1024)}MB`,
            );
          }
        },
        error: (error) => {
          this.logger.error(`❌ Error en ${url}: ${error.message}`);
        },
      }),
    );
  }

  getStats() {
    return {
      peakMemory: this.peakMemory,
      requestCount: this.requestCount,
      currentMemory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    };
  }
}
