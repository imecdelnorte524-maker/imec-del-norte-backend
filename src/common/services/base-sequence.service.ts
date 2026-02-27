// src/common/services/base-sequence.service.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import { SequenceHelperService } from './sequence-helper.service';

@Injectable()
export class BaseSequenceService {
  protected readonly logger = new Logger(this.constructor.name);
  protected tableName: string;
  protected idColumn: string;
  protected sequenceName?: string; // 👈 ahora opcional

  constructor(protected readonly sequenceHelper: SequenceHelperService) {}

  protected async initializeSequence(): Promise<void> {
    try {
      const sequenceInfo = await this.sequenceHelper.checkAndFixSequence(
        this.tableName,
        this.idColumn,
        this.sequenceName, // puede ser undefined
      );

      if (sequenceInfo.corrected) {
        this.logger.log(
          `✅ Secuencia ${sequenceInfo.sequenceName} corregida: ${sequenceInfo.lastValue - 1} → ${sequenceInfo.maxId}`,
        );
      } else {
        this.logger.log(
          `✓ Secuencia ${sequenceInfo.sequenceName || '(detectada automáticamente)'} OK. Último valor: ${sequenceInfo.lastValue}`,
        );
      }
    } catch (error: any) {
      this.logger.warn(
        `⚠️ No se pudo inicializar secuencia ${this.sequenceName || `${this.tableName}.${this.idColumn}`}: ${error.message}`,
      );
    }
  }

  async fixSequenceIfNeeded(): Promise<{
    corrected: boolean;
    message: string;
  }> {
    try {
      const sequenceInfo = await this.sequenceHelper.checkAndFixSequence(
        this.tableName,
        this.idColumn,
        this.sequenceName,
      );

      if (sequenceInfo.corrected) {
        return {
          corrected: true,
          message: `✅ Secuencia ${sequenceInfo.sequenceName} corregida: ${sequenceInfo.lastValue - 1} → ${sequenceInfo.maxId}`,
        };
      }

      return {
        corrected: false,
        message: `Secuencia ${sequenceInfo.sequenceName || '(detectada automáticamente)'} ya está actualizada`,
      };
    } catch (error: any) {
      const errorMessage = `❌ Error corrigiendo secuencia ${this.sequenceName || `${this.tableName}.${this.idColumn}`}: ${error.message}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  async diagnoseTable(uniqueColumns?: string[]): Promise<any> {
    try {
      const diagnosis = await this.sequenceHelper.diagnoseTable(
        this.tableName,
        this.idColumn,
        this.sequenceName, // opcional
        uniqueColumns,
      );

      return {
        tableName: this.tableName,
        idColumn: this.idColumn,
        sequenceName: diagnosis.sequence.sequenceName,
        ...diagnosis,
      };
    } catch (error: any) {
      this.logger.error(`Error en diagnóstico de ${this.tableName}:`, error);
      throw error;
    }
  }
}
