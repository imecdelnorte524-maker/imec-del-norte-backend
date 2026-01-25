import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync, mkdirSync } from 'fs';

async function bootstrap() {
  console.log('🚀 ========================================');
  console.log('🚀 INICIANDO APLICACIÓN NEST.JS');
  console.log('🚀 ========================================');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('IMEC del Norte API')
    .setDescription('Sistema de gestión para IMEC del Norte')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const allowedOrigins = [
    'https://imec-del-norte-web.onrender.com',
    'https://imec-del-norte-sandbox.onrender.com',
    'https://imec-del-norte-backend.onrender.com',
    'https://m3h6rtnz-3032.use.devtunnels.ms',
    'https://imec-del-norte.netlify.app',
    'http://localhost:5173',
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
    }),
  );

  const port = configService.get<number>('PORT') || 3032;
  console.log(`🔧 Puerto configurado: ${port}`);
  console.log(`🔧 Entorno: ${process.env.NODE_ENV || 'development'}`);

  await app.listen(port);
}
bootstrap();
