import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

config();

function getMigrationsInOrder(): string[] {
  const possiblePaths = [
    path.join(process.cwd(), 'src', 'migrations'),
    path.join(process.cwd(), 'dist', 'src', 'migrations'),
    path.join(process.cwd(), 'dist', 'migrations'),
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
      (file) =>
        (file.endsWith('.ts') || file.endsWith('.js')) &&
        !file.endsWith('.d.ts'),
    )
    .map((file) => {
      const match = file.match(/^(\d+)/);
      const timestamp = match ? parseInt(match[1], 10) : 0;

      return {
        name: file,
        path: path.join(migrationsDir, file).replace(/\\/g, '/'),
        timestamp,
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((m) => m.path);
}

const dataSource = new DataSource({
  type: 'postgres',
  // Prioriza la variable inyectada por el Makefile (localhost)
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '12345',
  database: process.env.DB_NAME || 'imec_del_norte',

  // Usa rutas absolutas para evitar el error MODULE_NOT_FOUND
  entities: [
    process.env.NODE_ENV === 'production'
      ? path.join(process.cwd(), 'dist', '**', '*.entity{.ts,.js}')
      : path.join(process.cwd(), 'src', '**', '*.entity{.ts,.js}'),
  ],
  migrations: getMigrationsInOrder(),
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
  migrationsTransactionMode: 'none',
});

export default dataSource;
