import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync, mkdirSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  console.log('🚀 ========================================');
  console.log('🚀 BACKEND IMEC: MODO AUTO-SINCRONIZACIÓN');
  console.log('🚀 ========================================');

  app.setGlobalPrefix('api');
  
  // Gestión de directorios
  const uploadsPath = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsPath)) mkdirSync(uploadsPath, { recursive: true });

  app.useStaticAssets(uploadsPath, { prefix: '/api/uploads' });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('IMEC del Norte API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.enableCors({ origin: '*', credentials: true });
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
  
  console.log(`\n✅ Backend iniciado en puerto: ${port}`);
  console.log(`✅ Tablas creadas/actualizadas vía synchronize: true\n`);
}

bootstrap();