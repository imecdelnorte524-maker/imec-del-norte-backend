import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

config();

interface MigrationFile {
  filename: string;
  timestamp: number;
  fullPath: string;
}

class MigrationRunner {
  private dataSource: DataSource;

  constructor() {
    this.dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '12345',
      database: process.env.DB_NAME || 'imec_del_norte',
      entities: ['src/**/*.entity{.ts,.js}'],
      migrations: [], // Vacío porque manejaremos manualmente
      synchronize: false,
      logging: true,
    });
  }

  async initialize() {
    await this.dataSource.initialize();
    console.log('✅ DataSource inicializado');
  }

  async getPendingMigrations(): Promise<MigrationFile[]> {
    const migrationsDir = path.join(__dirname, '../src/migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.ts') && !file.endsWith('.d.ts'));

    const migrationFiles: MigrationFile[] = files.map(file => {
      // Extraer timestamp del nombre (primera parte antes del primer guión)
      const match = file.match(/^(\d+)-/);
      const timestamp = match ? parseInt(match[1]) : 0;
      
      return {
        filename: file,
        timestamp,
        fullPath: path.join(migrationsDir, file),
      };
    });

    // Ordenar por timestamp (no alfabéticamente)
    return migrationFiles.sort((a, b) => a.timestamp - b.timestamp);
  }

  async getExecutedMigrations(): Promise<string[]> {
    // Crear tabla de migraciones si no existe
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        timestamp BIGINT NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const result = await this.dataSource.query(
      'SELECT name FROM migrations ORDER BY timestamp'
    );
    
    return result.map((row: any) => row.name);
  }

  async runMigration(migrationFile: MigrationFile): Promise<void> {
    console.log(`🚀 Ejecutando migración: ${migrationFile.filename}`);
    
    try {
      // Importar la migración dinámicamente
      const migrationPath = `../src/migrations/${migrationFile.filename}`;
      const migrationModule = require(migrationPath);
      const migrationClass = Object.values(migrationModule)[0] as any;
      
      if (!migrationClass || typeof migrationClass.prototype.up !== 'function') {
        throw new Error(`Módulo de migración inválido: ${migrationFile.filename}`);
      }

      const migrationInstance = new migrationClass();
      const queryRunner = this.dataSource.createQueryRunner();
      
      await queryRunner.connect();
      await queryRunner.startTransaction();
      
      try {
        await migrationInstance.up(queryRunner);
        
        // Registrar la migración como ejecutada
        await this.dataSource.query(
          'INSERT INTO migrations (name, timestamp) VALUES ($1, $2)',
          [migrationFile.filename, migrationFile.timestamp]
        );
        
        await queryRunner.commitTransaction();
        console.log(`✅ Migración completada: ${migrationFile.filename}`);
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      console.error(`❌ Error en migración ${migrationFile.filename}:`, error);
      throw error;
    }
  }

  async runAllMigrations() {
    await this.initialize();
    
    const pendingMigrations = await this.getPendingMigrations();
    const executedMigrations = await this.getExecutedMigrations();
    
    console.log(`📊 Migraciones encontradas: ${pendingMigrations.length}`);
    console.log(`📊 Migraciones ejecutadas: ${executedMigrations.length}`);
    
    // Filtrar migraciones no ejecutadas
    const migrationsToRun = pendingMigrations.filter(
      m => !executedMigrations.includes(m.filename)
    );
    
    if (migrationsToRun.length === 0) {
      console.log('🎉 No hay migraciones pendientes');
      return;
    }
    
    console.log(`🚀 Ejecutando ${migrationsToRun.length} migraciones pendientes...`);
    
    for (const migration of migrationsToRun) {
      console.log(`\n📋 Procesando: ${migration.filename} (timestamp: ${migration.timestamp})`);
      await this.runMigration(migration);
    }
    
    console.log('\n🎉 ¡Todas las migraciones ejecutadas correctamente!');
  }

  async fixMigrationNames() {
    console.log('🔧 Corrigiendo nombres de migraciones...');
    
    const migrationsDir = path.join(__dirname, '../src/migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.ts') && !file.endsWith('.d.ts'));
    
    // Corregir nombre de migración con typo
    for (const file of files) {
      if (file.includes('Reltionsforusers')) {
        const newName = file.replace('Reltionsforusers', 'RelationsForUsers');
        const oldPath = path.join(migrationsDir, file);
        const newPath = path.join(migrationsDir, newName);
        
        fs.renameSync(oldPath, newPath);
        console.log(`✅ Renombrado: ${file} -> ${newName}`);
      }
    }
  }

  async cleanup() {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
      console.log('🔌 DataSource cerrado');
    }
  }
}

async function main() {
  const runner = new MigrationRunner();
  
  try {
    // 1. Corregir nombres primero
    await runner.fixMigrationNames();
    
    // 2. Ejecutar migraciones en orden correcto
    await runner.runAllMigrations();
  } catch (error) {
    console.error('❌ Error durante la ejecución:', error);
    process.exit(1);
  } finally {
    await runner.cleanup();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

export { MigrationRunner };