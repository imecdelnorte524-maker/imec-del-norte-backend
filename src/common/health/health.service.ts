import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  constructor(private dataSource: DataSource) {}

  async checkAll() {
    const database = await this.checkDatabase();
    const memory = this.checkMemory();
    const uptime = this.getUptime();

    const status = database.status === 'ok' ? 'ok' : 'error';

    return {
      status,
      database,
      memory,
      uptime,
    };
  }

  async checkDatabase() {
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ok',
        message: 'Conexión a la base de datos establecida',
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Error en la conexión a la base de datos',
        error: error.message,
      };
    }
  }

  checkMemory() {
    const used = process.memoryUsage();
    return {
      rss: `${Math.round(used.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(used.external / 1024 / 1024)} MB`,
    };
  }

  getUptime() {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    return {
      seconds: Math.floor(uptime),
      formatted: `${days}d ${hours}h ${minutes}m ${seconds}s`,
    };
  }
}