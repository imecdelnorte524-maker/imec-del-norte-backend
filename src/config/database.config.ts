// src/config/database.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('database', () => {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT ?? '5432', 10);

  // Detecta entornos típicos sin SSL
  const isLocalHost =
    host === 'localhost' || host === '127.0.0.1' || host === 'postgres';

  const dbSslEnv = process.env.DB_SSL;
  let useSsl: boolean;

  if (dbSslEnv === 'true') useSsl = true;
  else if (dbSslEnv === 'false') useSsl = false;
  else useSsl = process.env.NODE_ENV === 'production' && !isLocalHost;

  const ssl = useSsl ? { rejectUnauthorized: false } : false;

  return {
    type: 'postgres' as const,
    host,
    port,
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '12345',
    database: process.env.DB_NAME || 'imec_del_norte',

    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    migrationsTableName: 'migrations',

    synchronize: false,
    migrationsRun: false,

    logging: process.env.TYPEORM_LOGGING === 'true',

    ssl,
    extra: {
      max: 20,
      connectionTimeoutMillis: 10000,
      ssl,
    },
  };
});
