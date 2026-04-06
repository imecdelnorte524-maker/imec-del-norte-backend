import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { memoryConfig } from './config/memory.config';
import * as express from 'express';

async function bootstrap() {
  console.log('🚀 ========================================');
  console.log('🚀 INICIANDO APLICACIÓN NEST.JS');
  console.log('🚀 ========================================');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);

  // ✅ Configurar límites de body correctamente
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('IMEC del Norte API')
    .setDescription(
      'Sistema de gestión para IMEC del Norte\n\n**Utilidades:**\n- [Gestión de Secuencias](/api/docs#/Database%20Sequences) - Para corregir problemas de IDs duplicados',
    )
    .setVersion('1.0')
    .addTag(
      'Database Sequences',
      'Endpoints para gestión y corrección de secuencias de base de datos',
    )
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const allowedOrigins = [
    'https://imec-del-norte-web.up.railway.app',
    'https://imec-del-norte-staggin.up.railway.app',
    'https://imec-del-norte-backend.up.railway.app',
    'https://fkm9z6xf-3032.use2.devtunnels.ms',
    'http://localhost:3032',
    'http://localhost:3000',
  ];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  allowedOrigins.forEach((origin) => console.log(`   • ${origin}`));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
        excludeExtraneousValues: false,
      },
    }),
  );

  const port = configService.get<number>('PORT') || 4001;
  console.log(`🔧 Puerto configurado: ${port}`);
  console.log(`🔧 Entorno: ${process.env.NODE_ENV || 'development'}`);

  await app.listen(port);
}

bootstrap();
