// src/utils/memory-helper.ts
import { Logger } from '@nestjs/common';

export class MemoryHelper {
  private static logger = new Logger('MemoryHelper');

  /**
   * Limpiar buffer de archivo
   */
  static clearFileBuffer(file: Express.Multer.File): void {
    if (file?.buffer) {
      file.buffer = Buffer.alloc(0);
    }
  }

  /**
   * Calcular tamaño aproximado de objeto
   */
  static estimateObjectSize(obj: any): number {
    const str = JSON.stringify(obj);
    return str ? Buffer.byteLength(str, 'utf8') : 0;
  }

  /**
   * Verificar si objeto excede límite
   */
  static isObjectTooBig(obj: any, limitMB: number = 1): boolean {
    const size = this.estimateObjectSize(obj);
    const sizeMB = size / (1024 * 1024);
    return sizeMB > limitMB;
  }

  /**
   * Forzar liberación de memoria
   */
  static async forceRelease(): Promise<void> {
    if (global.gc) {
      global.gc();
      await new Promise((resolve) => setTimeout(resolve, 100));
      global.gc();
      this.logger.log('🧹 GC forzado completado');
    }
  }

  /**
   * Obtener uso de memoria formateado
   */
  static getMemoryUsage(): Record<string, string> {
    const usage = process.memoryUsage();
    return {
      rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(usage.external / 1024 / 1024)} MB`,
    };
  }
}
