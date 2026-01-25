// scripts/check-migration-status.ts
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

config();

async function checkMigrationStatus() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '12345',
    database: process.env.DB_NAME || 'imec_del_norte',
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();

  // Obtener migraciones del filesystem
  const migrationsDir = path.join(__dirname, '../src/migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.ts'))
    .map(file => {
      const match = file.match(/^(\d+)-/);
      return {
        filename: file,
        timestamp: match ? parseInt(match[1]) : 0,
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  // Obtener migraciones ejecutadas
  let executedMigrations: any[] = [];
  try {
    executedMigrations = await dataSource.query('SELECT name, executed_at FROM migrations ORDER BY timestamp');
  } catch (error) {
    console.log('📊 Tabla migrations no existe aún');
  }

  console.log('📋 ESTADO DE MIGRACIONES');
  console.log('=' .repeat(50));
  console.log(`Total migraciones en FS: ${files.length}`);
  console.log(`Total migraciones ejecutadas: ${executedMigrations.length}`);
  console.log('');

  console.log('📁 Migraciones en orden cronológico:');
  files.forEach((file, index) => {
    const isExecuted = executedMigrations.some(m => m.name === file.filename);
    const status = isExecuted ? '✅' : '⏳';
    console.log(`${index + 1}. ${status} ${file.filename}`);
  });

  await dataSource.destroy();
}

checkMigrationStatus();