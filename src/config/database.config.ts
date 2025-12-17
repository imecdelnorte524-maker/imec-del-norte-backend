// src/config/database.config.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5431'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '12345',
  database: process.env.DB_NAME || 'imec_del_norte',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false, // ✅ FALSE en producción
  logging: process.env.NODE_ENV === 'development',
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  migrationsRun: true, // ✅ TRUE para ejecutar migraciones automáticamente
  extra: {
    max: 20, // máximo de conexiones en el pool
    connectionTimeoutMillis: 10000,
  },
}));