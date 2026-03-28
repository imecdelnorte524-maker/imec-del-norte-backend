import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';

export type ReportTokenPayload = {
  objectPath: string;
  fileName: string;
  ordenId: number;
  reportType: 'internal' | 'client';
};

@Injectable()
export class WoReportsTokenStore {
  private redis: Redis;
  private ttlSeconds: number;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error('REDIS_URL es requerida');

    this.redis = new Redis(redisUrl);
    this.ttlSeconds = Number(process.env.SUPABASE_TEMP_TTL_SECONDS || 600);
  }

  async createToken(payload: ReportTokenPayload): Promise<string> {
    const token = randomUUID();
    await this.redis.set(
      `wo:report:${token}`,
      JSON.stringify(payload),
      'EX',
      this.ttlSeconds,
    );
    return token;
  }

  /** 1 solo uso */
  async consumeToken(token: string): Promise<ReportTokenPayload | null> {
    const key = `wo:report:${token}`;
    const value = await this.redis.get(key);
    if (!value) return null;
    await this.redis.del(key);
    return JSON.parse(value) as ReportTokenPayload;
  }
}
