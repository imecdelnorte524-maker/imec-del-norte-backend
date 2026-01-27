// src/common/services/sequence-helper.service.ts
import { Global, Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

export interface SequenceInfo {
  tableName: string;
  idColumn: string;
  sequenceName: string;
  maxId: number;
  lastValue: number;
  synchronized: boolean;
  corrected: boolean;
}

export interface TableDiagnosis {
  sequence: SequenceInfo;
  uniqueConstraints: Array<{
    name: string;
    columns: string[];
    definition: string;
  }>;
  duplicateData: Array<{
    column: string;
    value: any;
    count: number;
  }>;
}

@Global()
@Injectable()
export class SequenceHelperService {
  private readonly logger = new Logger(SequenceHelperService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // src/common/services/sequence-helper.service.ts (agregar este método)
  /**
   * Obtiene información de todas las secuencias en la base de datos
   */
  async getAllSequences(): Promise<
    Array<{
      schema: string;
      name: string;
      lastValue: number;
      tableName?: string;
      columnName?: string;
    }>
  > {
    try {
      const sequences = await this.dataSource.query(`
      SELECT 
        schemaname as schema,
        sequencename as name,
        last_value as "lastValue"
      FROM pg_sequences
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY sequencename;
    `);

      // Intentar asociar secuencias con tablas
      const sequencesWithTables = await Promise.all(
        sequences.map(async (seq: any) => {
          try {
            const tableInfo = await this.dataSource.query(
              `
            SELECT 
              t.table_schema,
              t.table_name,
              c.column_name
            FROM information_schema.tables t
            JOIN information_schema.columns c 
              ON t.table_schema = c.table_schema 
              AND t.table_name = c.table_name
            WHERE t.table_type = 'BASE TABLE'
              AND t.table_schema NOT IN ('pg_catalog', 'information_schema')
              AND c.column_default LIKE '%' || $1 || '%'
            LIMIT 1;
          `,
              [seq.name],
            );

            return {
              ...seq,
              tableName: tableInfo[0]?.table_name,
              columnName: tableInfo[0]?.column_name,
            };
          } catch (error) {
            return seq;
          }
        }),
      );

      return sequencesWithTables;
    } catch (error: any) {
      this.logger.error('Error obteniendo todas las secuencias:', error);
      throw error;
    }
  }

  /**
   * Verifica y corrige una secuencia específica
   */
  async checkAndFixSequence(
    tableName: string,
    idColumn: string,
    sequenceName: string,
  ): Promise<SequenceInfo> {
    try {
      // 1. Verificar si existe la secuencia
      const sequenceExists = await this.dataSource.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_class 
          WHERE relkind = 'S' 
          AND relname = '${sequenceName.replace(/"/g, '')}'
        ) as exists;
      `);

      if (!sequenceExists[0]?.exists) {
        this.logger.warn(`⚠️  Secuencia ${sequenceName} no existe`);
        return {
          tableName,
          idColumn,
          sequenceName,
          maxId: 0,
          lastValue: 0,
          synchronized: true,
          corrected: false,
        };
      }

      // 2. Obtener máximo ID
      const maxIdResult = await this.dataSource.query(
        `SELECT MAX("${idColumn}") as max_id FROM ${tableName}`,
      );
      const maxId = maxIdResult[0]?.max_id ?? 0;

      // 3. Obtener último valor de secuencia
      const seqResult = await this.dataSource.query(
        `SELECT last_value FROM ${sequenceName}`,
      );
      const lastValue = seqResult[0]?.last_value ?? 0;

      // 4. Verificar si necesita corrección
      const needsFix = lastValue <= maxId;
      let corrected = false;
      let newLastValue = lastValue;

      // 5. Corregir si es necesario
      if (needsFix) {
        newLastValue = maxId + 1;
        await this.dataSource.query(
          `SELECT setval('${sequenceName}', $1, true)`,
          [newLastValue],
        );
        this.logger.log(
          `✅ Secuencia ${sequenceName} corregida: ${lastValue} → ${newLastValue}`,
        );
        corrected = true;
      }

      return {
        tableName,
        idColumn,
        sequenceName,
        maxId,
        lastValue: newLastValue,
        synchronized: !needsFix,
        corrected,
      };
    } catch (error: any) {
      this.logger.error(`Error con secuencia ${sequenceName}:`, error);
      throw error;
    }
  }

  /**
   * Verifica constraints UNIQUE de una tabla
   */
  async checkUniqueConstraints(tableName: string): Promise<{
    constraints: Array<{
      name: string;
      columns: string[];
      definition: string;
    }>;
  }> {
    try {
      const constraints = await this.dataSource.query(`
        SELECT 
          conname as name,
          pg_get_constraintdef(oid) as definition,
          (
            SELECT array_agg(attname)
            FROM unnest(conkey) conkey_idx
            JOIN pg_attribute ON pg_attribute.attrelid = conrelid AND pg_attribute.attnum = conkey_idx
          ) as columns
        FROM pg_constraint
        WHERE conrelid = '${tableName}'::regclass
          AND contype = 'u'
        ORDER BY conname;
      `);

      return {
        constraints: constraints.map((c: any) => ({
          name: c.name,
          columns: c.columns || [],
          definition: c.definition,
        })),
      };
    } catch (error: any) {
      this.logger.error(`Error obteniendo constraints de ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Busca datos duplicados en columnas específicas
   */
  async findDuplicateData(
    tableName: string,
    columns: string[],
  ): Promise<Array<{ column: string; value: any; count: number }>> {
    const duplicates: Array<{ column: string; value: any; count: number }> = [];

    try {
      for (const column of columns) {
        const results = await this.dataSource.query(`
          SELECT 
            '${column}' as column,
            "${column}" as value,
            COUNT(*) as count
          FROM ${tableName}
          WHERE "${column}" IS NOT NULL
          GROUP BY "${column}"
          HAVING COUNT(*) > 1;
        `);

        duplicates.push(...results);
      }
    } catch (error: any) {
      this.logger.error(`Error buscando duplicados en ${tableName}:`, error);
    }

    return duplicates;
  }

  /**
   * Diagnóstico completo de una tabla
   */
  async diagnoseTable(
    tableName: string,
    idColumn: string,
    sequenceName: string,
    uniqueColumns?: string[],
  ): Promise<TableDiagnosis> {
    try {
      // 1. Verificar secuencia
      const sequence = await this.checkAndFixSequence(
        tableName,
        idColumn,
        sequenceName,
      );

      // 2. Verificar constraints UNIQUE
      const constraintsResult = await this.checkUniqueConstraints(tableName);

      // 3. Buscar datos duplicados
      const duplicateData = uniqueColumns?.length
        ? await this.findDuplicateData(tableName, uniqueColumns)
        : [];

      return {
        sequence,
        uniqueConstraints: constraintsResult.constraints,
        duplicateData,
      };
    } catch (error: any) {
      this.logger.error(`Error en diagnóstico de ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Maneja errores de constraint UNIQUE
   */
  async handleUniqueConstraintError(error: any): Promise<{
    handled: boolean;
    message: string;
    suggestion?: string;
  }> {
    if (error.code === '23505') {
      const constraint = error.constraint || '';
      const detail = error.detail || '';

      this.logger.warn(`⚠️  Error de constraint UNIQUE: ${constraint}`);
      this.logger.warn(`   Detalle: ${detail}`);

      // Extraer información del error
      const match = detail.match(/Key \(([^)]+)\)=\(([^)]+)\) already exists/);

      if (match) {
        const [, column, value] = match;
        return {
          handled: false,
          message: `El valor ${value} ya existe en la columna ${column}`,
          suggestion: `Considera eliminar el constraint UNIQUE o usar un valor diferente`,
        };
      }

      return {
        handled: false,
        message: `Violación de constraint UNIQUE: ${constraint}`,
        suggestion: 'Verifica los datos duplicados',
      };
    }

    return {
      handled: false,
      message: 'No es un error de constraint UNIQUE',
    };
  }

  /**
   * Elimina un constraint UNIQUE
   */
  async dropUniqueConstraint(
    tableName: string,
    constraintName: string,
  ): Promise<boolean> {
    try {
      await this.dataSource.query(`
        ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS "${constraintName}";
      `);

      this.logger.log(
        `✅ Constraint ${constraintName} eliminado de ${tableName}`,
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        `Error eliminando constraint ${constraintName}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Crea un constraint UNIQUE compuesto más flexible
   */
  async createFlexibleUniqueConstraint(
    tableName: string,
    columns: string[],
    constraintName: string = `uq_${tableName}_flexible`,
  ): Promise<boolean> {
    try {
      const columnsStr = columns.map((col) => `"${col}"`).join(', ');

      await this.dataSource.query(`
        ALTER TABLE ${tableName} 
        ADD CONSTRAINT ${constraintName} 
        UNIQUE NULLS NOT DISTINCT (${columnsStr});
      `);

      this.logger.log(
        `✅ Constraint flexible ${constraintName} creado en ${tableName}`,
      );
      return true;
    } catch (error: any) {
      this.logger.error(`Error creando constraint flexible:`, error);
      return false;
    }
  }
}
