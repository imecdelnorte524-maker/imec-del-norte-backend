import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

config();

/**
 * TypeORM CLI corre este archivo en CommonJS.
 * Esta función asegura que las migraciones se carguen en el orden correcto
 * basándose en el timestamp del nombre del archivo.
 */
function getMigrationsInOrder(): string[] {
  // En Docker (dist), las migraciones están en dist/src/migrations o dist/migrations
  const possiblePaths = [
    path.join(__dirname, 'migrations'),
    path.join(process.cwd(), 'dist', 'src', 'migrations'),
    path.join(process.cwd(), 'dist', 'migrations')
  ];

  let migrationsDir = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      migrationsDir = p;
      break;
    }
  }

  if (!migrationsDir) {
    console.log('⚠️ No se encontró el directorio de migraciones.');
    return [];
  }

  return fs
    .readdirSync(migrationsDir)
    .filter(
      file =>
        (file.endsWith('.ts') || file.endsWith('.js')) &&
        !file.endsWith('.d.ts'),
    )
    .map(file => {
      // Extrae el número inicial del archivo (timestamp)
      const match = file.match(/^(\d+)/);
      const timestamp = match ? parseInt(match[1], 10) : 0;

      return {
        name: file,
        path: path.join(migrationsDir, file).replace(/\\/g, '/'),
        timestamp,
      };
    })
    // Orden ascendente: la migración más vieja primero
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(m => m.path);
}

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '12345',
  database: process.env.DB_NAME || 'imec_del_norte',

  // En producción (Docker) usamos los archivos compilados en dist
  entities: [
    process.env.NODE_ENV === 'production' 
      ? 'dist/**/*.entity{.ts,.js}' 
      : 'src/**/*.entity{.ts,.js}'
  ],
  migrations: getMigrationsInOrder(),

  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
});

export default dataSource;