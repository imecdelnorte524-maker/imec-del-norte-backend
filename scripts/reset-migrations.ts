import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

async function resetMigrations() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '12345',
    database: process.env.DB_NAME || 'imec_del_norte',
    synchronize: false,
    logging: true,
  });

  await dataSource.initialize();
  
  console.log('⚠️  ADVERTENCIA: Esto eliminará todas las migraciones registradas');
  console.log('Pero NO revertirá los cambios en la base de datos.');
  
  // Eliminar tabla de migraciones
  await dataSource.query('DROP TABLE IF EXISTS migrations');
  console.log('✅ Tabla de migraciones eliminada');
  
  // Crear tabla vacía
  await dataSource.query(`
    CREATE TABLE migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      timestamp BIGINT NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  console.log('✅ Tabla de migraciones recreada (vacía)');
  await dataSource.destroy();
}

if (require.main === module) {
  resetMigrations();
}