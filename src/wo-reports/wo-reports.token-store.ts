import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';

export type ReportTokenPayload = {
  objectPath: string;
  fileName: string;
  contentType: string; // <-- NUEVO (pdf/zip/etc)
  ordenId: number; // legacy: para batch guardamos el primero
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

  /**
   * Lee token SIN consumir (para no perderlo si la descarga tarda o se corta).
   */
  async getToken(token: string): Promise<ReportTokenPayload | null> {
    const value = await this.redis.get(`wo:report:${token}`);
    return value ? (JSON.parse(value) as ReportTokenPayload) : null;
  }

  /**
   * Borra token manualmente (lo usaremos cuando el response termine).
   */
  async deleteToken(token: string): Promise<void> {
    await this.redis.del(`wo:report:${token}`);
  }

  /** (Se deja por compatibilidad) 1 solo uso inmediato */
  async consumeToken(token: string): Promise<ReportTokenPayload | null> {
    const key = `wo:report:${token}`;
    const value = await this.redis.get(key);
    if (!value) return null;
    await this.redis.del(key);
    return JSON.parse(value) as ReportTokenPayload;
  }
}