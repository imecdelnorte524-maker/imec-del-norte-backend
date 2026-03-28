import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseTempStorageService } from './supabase-temp-storage.service';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function buildPrefixForMinute(d: Date) {
  return `reports/${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}/${pad(d.getUTCHours())}/${pad(d.getUTCMinutes())}`;
}

@Injectable()
export class WoReportsCleanupService {
  private readonly logger = new Logger(WoReportsCleanupService.name);
  private readonly ttlSeconds = Number(
    process.env.SUPABASE_TEMP_TTL_SECONDS || 600,
  );

  constructor(private readonly storage: SupabaseTempStorageService) {}

  /**
   * Cada 5 minutos, borra la carpeta del minuto "ahora - TTL - margen"
   * Esto no lista todo el bucket, solo ataca prefijos concretos.
   */
  @Cron('*/5 * * * *')
  async cleanupOldReports() {
    const marginSeconds = 60; // margen por relojes/colas
    const target = new Date(
      Date.now() - (this.ttlSeconds + marginSeconds) * 1000,
    );

    const prefix = buildPrefixForMinute(target);
    try {
      // Listar objetos dentro de ese prefix
      const items = await this.storage.list(prefix, 100, 0);
      if (!items.length) return;

      const pathsToDelete = items
        .filter((x: any) => x?.name)
        .map((x: any) => `${prefix}/${x.name}`);

      // OJO: list() de Supabase no trae recursivo; por eso la ruta que usamos
      // hace que el PDF esté directamente dentro del minuto/prefix.
      // Si quieres subcarpetas profundas, toca list recursivo (más complejo).
      await this.storage.remove(pathsToDelete);

      this.logger.log(
        `Cleanup: borrados ${pathsToDelete.length} archivos en ${prefix}`,
      );
    } catch (e: any) {
      this.logger.warn(`Cleanup falló para ${prefix}: ${e?.message ?? e}`);
    }
  }
}
