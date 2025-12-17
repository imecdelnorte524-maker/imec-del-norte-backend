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

  // ========================================
  // CONFIGURACIÓN DE ARCHIVOS ESTÁTICOS
  // ========================================
  console.log('\n📁 ========================================');
  console.log('📁 CONFIGURANDO ARCHIVOS ESTÁTICOS');
  console.log('📁 ========================================');

  // Definir rutas importantes
  const projectRoot = process.cwd();
  const distDir = __dirname;
  const uploadsRelativePath = join(__dirname, '..', '..', 'uploads');
  const uploadsAbsolutePath = join(projectRoot, 'uploads');

  console.log(`📂 Directorio actual (process.cwd()): ${projectRoot}`);
  console.log(`📂 Directorio de dist (__dirname): ${distDir}`);
  console.log(`📂 Ruta relativa a uploads: ${uploadsRelativePath}`);
  console.log(`📂 Ruta absoluta a uploads: ${uploadsAbsolutePath}`);

  // Verificar existencia de carpetas
  const uploadsExist = {
    relative: existsSync(uploadsRelativePath),
    absolute: existsSync(uploadsAbsolutePath),
    projectRoot: existsSync(projectRoot),
  };

  console.log('\n🔍 Verificando existencia de carpetas:');
  console.log(
    `   📁 ${uploadsRelativePath}: ${uploadsExist.relative ? '✅ EXISTE' : '❌ NO EXISTE'}`,
  );
  console.log(
    `   📁 ${uploadsAbsolutePath}: ${uploadsExist.absolute ? '✅ EXISTE' : '❌ NO EXISTE'}`,
  );
  console.log(
    `   📁 Raíz del proyecto: ${uploadsExist.projectRoot ? '✅ EXISTE' : '❌ NO EXISTE'}`,
  );

  // Crear carpetas si no existen
  const uploadsToUse = uploadsExist.relative
    ? uploadsRelativePath
    : uploadsAbsolutePath;

  // Asegurar que existan las subcarpetas
  const equipmentPath = join(uploadsToUse, 'equipment');
  const suppliesPath = join(uploadsToUse, 'supplies');

  [uploadsToUse, equipmentPath, suppliesPath].forEach((path) => {
    if (!existsSync(path)) {
      console.log(`   🔨 Creando carpeta: ${path}`);
      try {
        mkdirSync(path, { recursive: true });
        console.log(`   ✅ Carpeta creada: ${path}`);
      } catch (error) {
        console.error(`   ❌ Error creando carpeta ${path}:`, error.message);
      }
    }
  });

  console.log(`\n📁 Usando ruta para archivos estáticos: ${uploadsToUse}`);

  // Configurar static assets
  app.useStaticAssets(uploadsToUse, {
    prefix: '/api/uploads',
    setHeaders: (res) => {
      res.set('Cache-Control', 'public, max-age=31536000');
    },
  });

  console.log('\n🌐 Rutas de archivos estáticos disponibles:');
  console.log(
    `   📷 Equipos: http://localhost:${configService.get<number>('PORT') || 3000}/api/uploads/equipment/*`,
  );
  console.log(
    `   📷 Insumos: http://localhost:${configService.get<number>('PORT') || 3000}/api/uploads/supplies/*`,
  );

  // Listar archivos existentes
  console.log('\n📋 Archivos existentes en uploads:');
  try {
    const fs = require('fs');

    if (existsSync(equipmentPath)) {
      const equipmentFiles = fs.readdirSync(equipmentPath);
      console.log(`   📁 Equipment (${equipmentFiles.length} archivos):`);
      equipmentFiles.forEach((file) => {
        const filePath = join(equipmentPath, file);
        const stats = fs.statSync(filePath);
        console.log(`      - ${file} (${Math.round(stats.size / 1024)} KB)`);
      });
    }

    if (existsSync(suppliesPath)) {
      const suppliesFiles = fs.readdirSync(suppliesPath);
      console.log(`   📁 Supplies (${suppliesFiles.length} archivos):`);
      suppliesFiles.forEach((file) => {
        const filePath = join(suppliesPath, file);
        const stats = fs.statSync(filePath);
        console.log(`      - ${file} (${Math.round(stats.size / 1024)} KB)`);
      });
    }
  } catch (error) {
    console.log(`   ⚠️ Error listando archivos: ${error.message}`);
  }

  // ========================================
  // SWAGGER DOCUMENTATION
  // ========================================
  console.log('\n📚 ========================================');
  console.log('📚 CONFIGURANDO SWAGGER DOCUMENTATION');
  console.log('📚 ========================================');

  const config = new DocumentBuilder()
    .setTitle('IMEC del Norte API')
    .setDescription('Sistema de gestión para IMEC del Norte')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  console.log(
    `📚 Swagger disponible en: http://localhost:${configService.get<number>('PORT') || 3000}/api/docs`,
  );

  // ========================================
  // SEGURIDAD
  // ========================================
  console.log('\n🔒 ========================================');
  console.log('🔒 CONFIGURANDO SEGURIDAD');
  console.log('🔒 ========================================');
  app.use(helmet());
  console.log('✅ Helmet configurado para seguridad HTTP');

  // ========================================
  // CORS
  // ========================================
  console.log('\n🌍 ========================================');
  console.log('🌍 CONFIGURANDO CORS');
  console.log('🌍 ========================================');

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

  console.log(`✅ CORS habilitado para ${allowedOrigins.length} orígenes:`);
  allowedOrigins.forEach((origin) => console.log(`   • ${origin}`));

  // ========================================
  // VALIDACIÓN
  // ========================================
  console.log('\n✅ ========================================');
  console.log('✅ CONFIGURANDO VALIDACIÓN');
  console.log('✅ ========================================');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  console.log('✅ ValidationPipe configurado (whitelist, transform)');

  // ========================================
  // INICIAR SERVIDOR
  // ========================================
  console.log('\n🚀 ========================================');
  console.log('🚀 INICIANDO SERVIDOR');
  console.log('🚀 ========================================');

  const port = configService.get<number>('PORT') || 3000;
  console.log(`🔧 Puerto configurado: ${port}`);
  console.log(`🔧 Entorno: ${process.env.NODE_ENV || 'development'}`);

  await app.listen(port);

  // ========================================
  // RESUMEN FINAL
  // ========================================
  console.log('\n🎉 ========================================');
  console.log('🎉 APLICACIÓN INICIADA CORRECTAMENTE');
  console.log('🎉 ========================================');

  console.log(`\n📍 URLS DISPONIBLES:`);
  console.log(
    `   🌐 API:          https://fvwg9xhq-${port}.use.devtunnels.ms//api`,
  );
  console.log(
    `   📷 UPLOADS:      https://fvwg9xhq-${port}.use.devtunnels.ms//api/uploads`,
  );
  console.log(
    `   📚 DOCS:         https://fvwg9xhq-${port}.use.devtunnels.ms//api/docs`,
  );

  console.log(`\n📁 RUTAS DE ARCHIVOS:`);
  console.log(`   📂 Uploads path: ${uploadsToUse}`);
  console.log(`   🔗 Ruta estática: /api/uploads/`);

  console.log(`\n⚙️  CONFIGURACIONES:`);
  console.log(`   📍 Puerto: ${port}`);
  console.log(`   🏷️  Prefijo global: /api`);
  console.log(`   🔐 CORS: Habilitado para ${allowedOrigins.length} orígenes`);

  console.log('\n🔍 PARA VERIFICAR ARCHIVOS:');
  console.log(
    `   • Equipos: https://fvwg9xhq-${port}.use.devtunnels.ms//api/uploads/equipment/`,
  );
  console.log(
    `   • Insumos: https://fvwg9xhq-${port}.use.devtunnels.ms//api/uploads/supplies/`,
  );

  console.log('\n⚠️  SI NO VES LAS IMÁGENES:');
  console.log('   1. Verifica que los archivos existan en la carpeta uploads');
  console.log('   2. Revisa los logs de arriba para ver las rutas exactas');
  console.log(
    '   3. Asegúrate que la URL en la DB coincida con la ruta estática',
  );

  console.log('\n✅ Todo listo! La aplicación está funcionando correctamente.');
  console.log('========================================\n');
}

bootstrap();
