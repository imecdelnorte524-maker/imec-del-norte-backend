import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WO_REPORTS_QUEUE, WoReportJobData } from '../shared';

@Injectable()
export class WoReportsQueueService {
  constructor(
    @InjectQueue(WO_REPORTS_QUEUE)
    private readonly queue: Queue,
  ) {}

  async enqueue(data: WoReportJobData) {
    const job = await this.queue.add('generate-report', data, {
      removeOnComplete: true,
      removeOnFail: true,
      attempts: 2,
      backoff: { type: 'exponential', delay: 2000 },
    });

    return { jobId: job.id };
  }
}
