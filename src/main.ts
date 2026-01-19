import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
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
  // Definir rutas importantes
  const projectRoot = process.cwd();
  const distDir = __dirname;
  const uploadsRelativePath = join(__dirname, '..', '..', 'uploads');
  const uploadsAbsolutePath = join(projectRoot, 'uploads');

  // Verificar existencia de carpetas
  const uploadsExist = {
    relative: existsSync(uploadsRelativePath),
    absolute: existsSync(uploadsAbsolutePath),
    projectRoot: existsSync(projectRoot),
  };

  // Crear carpetas si no existen
  const uploadsToUse = uploadsExist.relative
    ? uploadsRelativePath
    : uploadsAbsolutePath;

  const invoicesPath = join(uploadsToUse, 'invoices');

  [uploadsToUse, invoicesPath].forEach((path) => {
    if (!existsSync(path)) {
      try {
        mkdirSync(path, { recursive: true });
      } catch (error) {
        console.error(`   ❌ Error creando carpeta ${path}:`, error.message);
      }
    }
  });

  // Configurar static assets
  app.useStaticAssets(uploadsToUse, {
    prefix: '/api/uploads',
    setHeaders: (res) => {
      res.set('Cache-Control', 'public, max-age=31536000');
    },
  });

  // Listar archivos existentes
 try {
    const fs = require('fs');

    if (existsSync(invoicesPath)) {
      const invocesFiles = fs.readdirSync(invoicesPath);
    invocesFiles.forEach((file) => {
        const filePath = join(invoicesPath, file);
        const stats = fs.statSync(filePath);
        console.log(`      - ${file} (${Math.round(stats.size / 1024)} KB)`);
      });
    }
  } catch (error) {
    console.log(`   ⚠️ Error listando archivos: ${error.message}`);
  }

  const config = new DocumentBuilder()
    .setTitle('IMEC del Norte API')
    .setDescription('Sistema de gestión para IMEC del Norte')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const allowedOrigins = [
    'https://imec-del-norte.onrender.com',
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

  const port = configService.get<number>('PORT') || 3000;
  console.log(`🔧 Puerto configurado: ${port}`);
  console.log(`🔧 Entorno: ${process.env.NODE_ENV || 'development'}`);

  await app.listen(port);
}
bootstrap();
