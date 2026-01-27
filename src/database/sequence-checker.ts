import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface SequenceReport {
  tableName: string;
  columnName: string;
  sequenceName: string;
  maxId: number;
  lastValue: number;
  status: 'OK' | 'DESINCRONIZADA' | 'ERROR';
  diff: number;
  schema: string;
}

@Injectable()
export class SequenceCheckerService implements OnModuleInit {
  private readonly logger = new Logger(SequenceCheckerService.name);

  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async onModuleInit() {
    // Verifica secuencias al iniciar (solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      await this.showReport();
    }
  }

  async checkAllSequences(): Promise<SequenceReport[]> {
    const reports: SequenceReport[] = [];
    
    try {
      const tables = await this.dataSource.query(`
        SELECT 
          table_schema as schema_name,
          table_name,
          column_name,
          column_default
        FROM 
          information_schema.columns
        WHERE 
          table_schema = 'public'
          AND column_default LIKE 'nextval%'
        ORDER BY 
          table_name, column_name;
      `);

      for (const table of tables) {
        try {
          const match = table.column_default.match(/'([^']+)'/);
          const sequenceName = match ? match[1] : null;
          
          if (!sequenceName) continue;

          const maxResult = await this.dataSource.query(`
            SELECT COALESCE(MAX(${table.column_name}), 0) as max_id 
            FROM ${table.schema_name}.${table.table_name}
          `);
          const maxId = parseInt(maxResult[0]?.max_id) || 0;

          const seqResult = await this.dataSource.query(`
            SELECT last_value 
            FROM ${sequenceName}
          `);
          const lastValue = parseInt(seqResult[0]?.last_value) || 0;

          const diff = lastValue - maxId;
          let status: SequenceReport['status'] = 'OK';
          
          if (lastValue < maxId) {
            status = 'DESINCRONIZADA';
          }

          reports.push({
            tableName: table.table_name,
            columnName: table.column_name,
            sequenceName,
            maxId,
            lastValue,
            status,
            diff,
            schema: table.schema_name,
          });

        } catch (error) {
          reports.push({
            tableName: table.table_name,
            columnName: table.column_name,
            sequenceName: 'ERROR',
            maxId: 0,
            lastValue: 0,
            status: 'ERROR',
            diff: 0,
            schema: table.schema_name,
          });
        }
      }
    } catch (error) {
      this.logger.error('Error general:', error);
    }

    return reports;
  }

  async fixSequence(sequenceName: string, newValue: number): Promise<boolean> {
    try {
      await this.dataSource.query(`
        SELECT setval('${sequenceName}', ${newValue}, false)
      `);
      return true;
    } catch (error) {
      return false;
    }
  }

  async fixAllDesincronizadas(): Promise<{ fixed: number; total: number }> {
    const reports = await this.checkAllSequences();
    const problemas = reports.filter(r => r.status === 'DESINCRONIZADA');
    
    let fixed = 0;
    
    for (const report of problemas) {
      const success = await this.fixSequence(report.sequenceName, report.maxId + 1);
      if (success) fixed++;
    }

    return { fixed, total: problemas.length };
  }

  async showReport(): Promise<void> {
    console.log('\n══════════════════════════════════════════════');
    console.log('           VERIFICACIÓN DE SECUENCIAS');
    console.log('══════════════════════════════════════════════\n');
    
    const reports = await this.checkAllSequences();
    
    if (reports.length === 0) {
      console.log('No se encontraron secuencias.');
      return;
    }

    const ok = reports.filter(r => r.status === 'OK').length;
    const problemas = reports.filter(r => r.status === 'DESINCRONIZADA');
    const errores = reports.filter(r => r.status === 'ERROR').length;

    console.log(`📊 TOTAL: ${reports.length} secuencias`);
    console.log(`✅ OK: ${ok}`);
    console.log(`⚠️  DESINCRONIZADAS: ${problemas.length}`);
    console.log(`❌ ERRORES: ${errores}\n`);

    if (problemas.length > 0) {
      console.log('🔴 SECUENCIAS DESINCRONIZADAS:');
      console.log('──────────────────────────────────────────────');
      console.log('TABLA                    COLUMNA        MÁX  ÚLTIMO  DIF');
      console.log('──────────────────────────────────────────────');
      
      problemas.forEach(report => {
        console.log(
          `${report.tableName.padEnd(25)}` +
          `${report.columnName.padEnd(15)}` +
          `${report.maxId.toString().padEnd(5)}` +
          `${report.lastValue.toString().padEnd(7)}` +
          `${report.diff}`
        );
      });
      
      console.log('\n💡 Para corregir: npm run db:fix-sequences\n');
    }

    console.log('══════════════════════════════════════════════\n');
  }
}