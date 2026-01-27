// src/common/services/base-sequence.service.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import { SequenceHelperService } from './sequence-helper.service';

@Injectable()
export class BaseSequenceService {
  protected readonly logger = new Logger(this.constructor.name);
  protected tableName: string;
  protected idColumn: string;
  protected sequenceName: string;

  constructor(
    protected readonly sequenceHelper: SequenceHelperService,
  ) {}

  /**
   * Inicializa y corrige la secuencia
   */
  protected async initializeSequence(): Promise<void> {
    try {
      const sequenceInfo = await this.sequenceHelper.checkAndFixSequence(
        this.tableName,
        this.idColumn,
        this.sequenceName,
      );

      if (sequenceInfo.corrected) {
        this.logger.log(
          `✅ Secuencia ${this.sequenceName} corregida: ${sequenceInfo.lastValue - 1} → ${sequenceInfo.maxId}`,
        );
      } else if (!sequenceInfo.synchronized) {
        this.logger.log(
          `✓ Secuencia ${this.sequenceName} OK. Último valor: ${sequenceInfo.lastValue}`,
        );
      }
    } catch (error: any) {
      this.logger.warn(
        `⚠️ No se pudo inicializar secuencia ${this.sequenceName}: ${error.message}`,
      );
    }
  }

  /**
   * Corrige la secuencia si está desincronizada
   */
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
          message: `✅ Secuencia ${this.sequenceName} corregida: ${sequenceInfo.lastValue - 1} → ${sequenceInfo.maxId}`,
        };
      }

      return {
        corrected: false,
        message: `Secuencia ${this.sequenceName} ya está actualizada`,
      };
    } catch (error: any) {
      const errorMessage = `❌ Error corrigiendo secuencia ${this.sequenceName}: ${error.message}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Diagnóstico de la tabla
   */
  async diagnoseTable(uniqueColumns?: string[]): Promise<any> {
    try {
      const diagnosis = await this.sequenceHelper.diagnoseTable(
        this.tableName,
        this.idColumn,
        this.sequenceName,
        uniqueColumns,
      );

      return {
        tableName: this.tableName,
        idColumn: this.idColumn,
        sequenceName: this.sequenceName,
        ...diagnosis,
      };
    } catch (error: any) {
      this.logger.error(`Error en diagnóstico de ${this.tableName}:`, error);
      throw error;
    }
  }
}