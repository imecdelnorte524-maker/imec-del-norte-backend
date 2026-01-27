// src/database/sequences.controller.ts
import { Controller, Get, Post, Query, HttpStatus, HttpException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SequenceCheckerService, SequenceReport } from './sequence-checker';

@ApiTags('Database Sequences')
@Controller('database/sequences')
export class SequencesController {
  constructor(
    private readonly sequenceChecker: SequenceCheckerService,
  ) {}

  @Get('check')
  @ApiOperation({ 
    summary: 'Verificar estado de secuencias', 
    description: 'Verifica si las secuencias de auto-incremento están sincronizadas con los datos reales' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Reporte de secuencias generado exitosamente' 
  })
  async checkSequences(): Promise<{
    success: boolean;
    timestamp: string;
    database: string;
    summary: {
      total: number;
      ok: number;
      desincronizadas: number;
      errores: number;
    };
    reports: SequenceReport[];
    message: string;
  }> {
    try {
      const reports = await this.sequenceChecker.checkAllSequences();
      const ok = reports.filter(r => r.status === 'OK').length;
      const desincronizadas = reports.filter(r => r.status === 'DESINCRONIZADA').length;
      const errores = reports.filter(r => r.status === 'ERROR').length;

      return {
        success: true,
        timestamp: new Date().toISOString(),
        database: process.env.DB_NAME || 'unknown',
        summary: {
          total: reports.length,
          ok,
          desincronizadas,
          errores,
        },
        reports,
        message: desincronizadas > 0 
          ? `Se encontraron ${desincronizadas} secuencias desincronizadas. Use POST /database/sequences/fix para corregirlas.`
          : 'Todas las secuencias están sincronizadas correctamente.',
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: `Error verificando secuencias: ${error.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('fix')
  @ApiOperation({ 
    summary: 'Corregir secuencias desincronizadas', 
    description: 'Corrige automáticamente las secuencias que no están sincronizadas con los datos' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Secuencias corregidas exitosamente' 
  })
  async fixSequences(): Promise<{
    success: boolean;
    timestamp: string;
    corrected: {
      fixed: number;
      total: number;
      details: Array<{
        table: string;
        column: string;
        sequence: string;
        oldValue: number;
        newValue: number;
      }>;
    };
    message: string;
  }> {
    try {
      // Obtener estado antes de corregir
      const reportsBefore = await this.sequenceChecker.checkAllSequences();
      const problemas = reportsBefore.filter(r => r.status === 'DESINCRONIZADA');
      
      if (problemas.length === 0) {
        return {
          success: true,
          timestamp: new Date().toISOString(),
          corrected: {
            fixed: 0,
            total: 0,
            details: [],
          },
          message: 'No hay secuencias desincronizadas que corregir.',
        };
      }

      // Corregir las secuencias
      const result = await this.sequenceChecker.fixAllDesincronizadas();
      
      // Obtener detalles de lo que se corrigió
      const details = problemas.map(problema => ({
        table: problema.tableName,
        column: problema.columnName,
        sequence: problema.sequenceName,
        oldValue: problema.lastValue,
        newValue: problema.maxId + 1,
      }));

      // Verificar estado después de corregir
      const reportsAfter = await this.sequenceChecker.checkAllSequences();
      const problemasDespues = reportsAfter.filter(r => r.status === 'DESINCRONIZADA');

      return {
        success: true,
        timestamp: new Date().toISOString(),
        corrected: {
          fixed: result.fixed,
          total: result.total,
          details,
        },
        message: problemasDespues.length === 0
          ? `✅ Corregidas ${result.fixed} de ${result.total} secuencias exitosamente.`
          : `⚠️ Corregidas ${result.fixed} de ${result.total} secuencias. Aún quedan ${problemasDespues.length} problemas sin corregir.`,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: `Error corrigiendo secuencias: ${error.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('check-table')
  @ApiOperation({ 
    summary: 'Verificar secuencia de tabla específica', 
    description: 'Verifica el estado de la secuencia de una tabla específica' 
  })
  @ApiQuery({ name: 'table', required: true, description: 'Nombre de la tabla' })
  @ApiQuery({ name: 'column', required: false, description: 'Nombre de la columna (opcional)' })
  @ApiResponse({ status: 200, description: 'Estado de la secuencia obtenido' })
  async checkTableSequence(
    @Query('table') table: string,
    @Query('column') column?: string,
  ): Promise<{
    success: boolean;
    table: string;
    status: 'OK' | 'DESINCRONIZADA' | 'NO_SEQUENCE' | 'ERROR';
    details?: {
      column: string;
      sequenceName: string;
      maxId: number;
      lastValue: number;
      difference: number;
      shouldBe: number;
    };
    message: string;
  }> {
    try {
      // Consultar secuencias de la tabla específica
      const query = column 
        ? `
          SELECT column_name, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = $2
            AND column_default LIKE 'nextval%'
        `
        : `
          SELECT column_name, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_default LIKE 'nextval%'
          LIMIT 1
        `;

      const params = column ? [table, column] : [table];
      const columns = await this.sequenceChecker['dataSource'].query(query, params);

      if (columns.length === 0) {
        return {
          success: false,
          table,
          status: 'NO_SEQUENCE',
          message: column 
            ? `La columna "${column}" de la tabla "${table}" no tiene secuencia.`
            : `La tabla "${table}" no tiene columnas con secuencia automática.`,
        };
      }

      const columnaInfo = columns[0];
      const match = columnaInfo.column_default.match(/'([^']+)'/);
      const sequenceName = match ? match[1] : null;

      if (!sequenceName) {
        return {
          success: false,
          table,
          status: 'ERROR',
          message: 'No se pudo extraer el nombre de la secuencia.',
        };
      }

      // Obtener máximo ID
      const maxResult = await this.sequenceChecker['dataSource'].query(`
        SELECT COALESCE(MAX(${columnaInfo.column_name}), 0) as max_id 
        FROM public.${table}
      `);
      const maxId = parseInt(maxResult[0]?.max_id) || 0;

      // Obtener último valor de secuencia
      const seqResult = await this.sequenceChecker['dataSource'].query(`
        SELECT last_value 
        FROM ${sequenceName}
      `);
      const lastValue = parseInt(seqResult[0]?.last_value) || 0;

      const difference = lastValue - maxId;
      const status: 'OK' | 'DESINCRONIZADA' = lastValue >= maxId ? 'OK' : 'DESINCRONIZADA';

      return {
        success: true,
        table,
        status,
        details: {
          column: columnaInfo.column_name,
          sequenceName,
          maxId,
          lastValue,
          difference,
          shouldBe: maxId + 1,
        },
        message: status === 'OK'
          ? `✅ La secuencia de ${table}.${columnaInfo.column_name} está sincronizada.`
          : `⚠️ La secuencia de ${table}.${columnaInfo.column_name} está desincronizada. Último valor: ${lastValue}, Máximo ID: ${maxId}.`,
      };
    } catch (error) {
      return {
        success: false,
        table,
        status: 'ERROR',
        message: `Error verificando tabla ${table}: ${error.message}`,
      };
    }
  }

  @Post('fix-table')
  @ApiOperation({ 
    summary: 'Corregir secuencia de tabla específica', 
    description: 'Corrige la secuencia de una tabla específica' 
  })
  @ApiQuery({ name: 'table', required: true, description: 'Nombre de la tabla' })
  @ApiQuery({ name: 'column', required: false, description: 'Nombre de la columna (opcional)' })
  @ApiResponse({ status: 200, description: 'Secuencia corregida exitosamente' })
  async fixTableSequence(
    @Query('table') table: string,
    @Query('column') column?: string,
  ): Promise<{
    success: boolean;
    table: string;
    corrected?: {
      sequence: string;
      oldValue: number;
      newValue: number;
    };
    message: string;
  }> {
    try {
      // Primero verificar el estado
      const checkResult = await this.checkTableSequence(table, column);
      
      if (!checkResult.success || checkResult.status === 'ERROR' || checkResult.status === 'NO_SEQUENCE') {
        return {
          success: false,
          table,
          message: checkResult.message,
        };
      }

      if (checkResult.status === 'OK') {
        return {
          success: true,
          table,
          message: 'La secuencia ya está sincronizada, no es necesario corregir.',
        };
      }

      // Corregir la secuencia
      const { details } = checkResult;
      if (!details) {
        return {
          success: false,
          table,
          message: 'No se encontraron detalles para corregir.',
        };
      }

      const corrected = await this.sequenceChecker.fixSequence(
        details.sequenceName, 
        details.maxId + 1
      );

      if (corrected) {
        return {
          success: true,
          table,
          corrected: {
            sequence: details.sequenceName,
            oldValue: details.lastValue,
            newValue: details.maxId + 1,
          },
          message: `✅ Secuencia ${details.sequenceName} corregida de ${details.lastValue} a ${details.maxId + 1}.`,
        };
      } else {
        return {
          success: false,
          table,
          message: `❌ No se pudo corregir la secuencia ${details.sequenceName}.`,
        };
      }
    } catch (error) {
      return {
        success: false,
        table,
        message: `Error corrigiendo tabla ${table}: ${error.message}`,
      };
    }
  }

  @Get('status')
  @ApiOperation({ 
    summary: 'Estado general del sistema de secuencias', 
    description: 'Obtiene un resumen general del estado de las secuencias' 
  })
  async getSystemStatus(): Promise<{
    success: boolean;
    timestamp: string;
    system: {
      database: string;
      host: string;
      port: number;
      environment: string;
    };
    sequences: {
      total: number;
      withProblems: number;
      health: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    };
    recommendations: string[];
  }> {
    try {
      const reports = await this.sequenceChecker.checkAllSequences();
      const problemas = reports.filter(r => r.status === 'DESINCRONIZADA' || r.status === 'ERROR');
      
      let health: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
      const recommendations: string[] = [];

      if (problemas.length > 0) {
        health = 'WARNING';
        recommendations.push(`Se encontraron ${problemas.length} secuencias con problemas.`);
        
        const inventarioProblemas = problemas.filter(p => p.tableName.includes('inventario'));
        if (inventarioProblemas.length > 0) {
          recommendations.push(`Tabla "inventario" tiene ${inventarioProblemas.length} secuencias desincronizadas.`);
          recommendations.push('Use POST /database/sequences/fix para corregir automáticamente.');
        }
      }

      if (reports.filter(r => r.status === 'ERROR').length > 5) {
        health = 'CRITICAL';
        recommendations.push('Existen múltiples errores críticos en las secuencias.');
        recommendations.push('Revise la conectividad con la base de datos.');
      }

      return {
        success: true,
        timestamp: new Date().toISOString(),
        system: {
          database: process.env.DB_NAME || 'unknown',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          environment: process.env.NODE_ENV || 'development',
        },
        sequences: {
          total: reports.length,
          withProblems: problemas.length,
          health,
        },
        recommendations,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: `Error obteniendo estado del sistema: ${error.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}