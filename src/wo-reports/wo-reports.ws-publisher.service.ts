import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { WO_REPORTS_REDIS_CHANNEL, WoReportWsEvent } from './wo-reports.events';

@Injectable()
export class WoReportsWsPublisherService {
  private redis: Redis;

  constructor() {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error('REDIS_URL es requerida');
    this.redis = new Redis(url);
  }

  async publish(event: WoReportWsEvent) {
    await this.redis.publish(WO_REPORTS_REDIS_CHANNEL, JSON.stringify(event));
  }
}
