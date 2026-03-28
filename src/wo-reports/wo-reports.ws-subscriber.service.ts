import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import Redis from 'ioredis';
import { RealtimeService } from '../realtime/realtime.service';
import { WO_REPORTS_REDIS_CHANNEL, WoReportWsEvent } from './wo-reports.events';

@Injectable()
export class WoReportsWsSubscriberService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(WoReportsWsSubscriberService.name);
  private sub!: Redis;

  constructor(private readonly realtime: RealtimeService) {}

  async onModuleInit() {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error('REDIS_URL es requerida');

    this.sub = new Redis(url);
    await this.sub.subscribe(WO_REPORTS_REDIS_CHANNEL);

    this.sub.on('message', (channel, message) => {
      if (channel !== WO_REPORTS_REDIS_CHANNEL) return;

      try {
        const evt = JSON.parse(message) as WoReportWsEvent;

        if (evt.type === 'ready') {
          this.realtime.emitToUser(
            evt.userId,
            'workOrders.report.ready',
            evt.payload,
          );
        } else if (evt.type === 'sent') {
          this.realtime.emitToUser(
            evt.userId,
            'workOrders.report.sent',
            evt.payload,
          );
        } else if (evt.type === 'error') {
          this.realtime.emitToUser(
            evt.userId,
            'workOrders.report.error',
            evt.payload,
          );
        }
      } catch (e: any) {
        this.logger.warn(`Error procesando mensaje pubsub: ${e?.message ?? e}`);
      }
    });

    this.logger.log(`Suscrito a ${WO_REPORTS_REDIS_CHANNEL}`);
  }

  async onModuleDestroy() {
    try {
      await this.sub?.unsubscribe(WO_REPORTS_REDIS_CHANNEL);
      await this.sub?.quit();
    } catch {}
  }
}
