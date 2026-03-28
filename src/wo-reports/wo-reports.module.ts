import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WorkOrdersModule } from '../work-orders/work-orders.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { MailModule } from '../mail/mail.module';
import { WoReportsQueueService } from './wo-reports.queue.service';
import { WoReportsTokenStore } from './wo-reports.token-store';
import { SupabaseTempStorageService } from './supabase-temp-storage.service';
import { WoReportsProcessor } from './wo-reports.processor';
import { WoReportsCleanupService } from './wo-reports.cleanup.service';
import { WoReportsWsPublisherService } from './wo-reports.ws-publisher.service';
import { WoReportsWsSubscriberService } from './wo-reports.ws-subscriber.service';

const isApi = (process.env.PROCESS_TYPE || 'api') === 'api';

@Module({
  imports: [
    forwardRef(() => WorkOrdersModule),
    MailModule,
    RealtimeModule,
    BullModule.registerQueue({
      name: 'wo-reports',
      connection: { url: process.env.REDIS_URL },
    }),
  ],
  providers: [
    WoReportsQueueService,
    WoReportsTokenStore,
    SupabaseTempStorageService,
    WoReportsProcessor,
    WoReportsCleanupService,
    WoReportsWsPublisherService,
    ...(isApi ? [WoReportsWsSubscriberService] : []), // ✅ solo API
  ],
  exports: [
    WoReportsQueueService,
    WoReportsTokenStore,
    SupabaseTempStorageService,
  ],
})
export class WoReportsModule {}
