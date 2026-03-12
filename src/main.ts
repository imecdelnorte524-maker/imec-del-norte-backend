import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { memoryConfig } from './config/memory.config';
import * as express from 'express';

// Función para monitorear memoria
function startMemoryMonitoring() {
  const MB = 1024 * 1024;
  let peakHeap = 0;
  let peakRSS = 0;

  setInterval(() => {
    const mem = process.memoryUsage();
    const heapUsed = Math.round(mem.heapUsed / MB);
    const heapTotal = Math.round(mem.heapTotal / MB);
    const rss = Math.round(mem.rss / MB);

    if (heapUsed > peakHeap) peakHeap = heapUsed;
    if (rss > peakRSS) peakRSS = rss;

    const heapUsagePercent = Math.round((mem.heapUsed / mem.heapTotal) * 100);

    // Log cada 30 segundos
    const logLevel =
      heapUsagePercent > (memoryConfig?.alerts?.heapThreshold || 0.7) * 100
        ? 'error'
        : 'log';

    console[logLevel](
      `📊 MEMORIA: heapUsed=${heapUsed}MB/${heapTotal}MB (${heapUsagePercent}%) rss=${rss}MB | PEAK: heap=${peakHeap}MB rss=${peakRSS}MB`,
    );

    // Alerta si la memoria está muy alta
    if (heapUsagePercent > 95 && heapUsed > 500) {
      // Solo alerta si >95% Y >500MB
      console.error(
        `🔥 MEMORIA CRÍTICA: ${heapUsagePercent}% usado (${heapUsed}MB)`,
      );

      if (global.gc) {
        console.log('🧹 Forzando garbage collection...');
        global.gc();
      }
    }
  }, memoryConfig?.alerts?.checkInterval || 30000);
}

async function bootstrap() {
  console.log('🚀 ========================================');
  console.log('🚀 INICIANDO APLICACIÓN NEST.JS');
  console.log('🚀 ========================================');

  // Mostrar límites de memoria al inicio
  const initialMem = process.memoryUsage();
  console.log(
    `📊 Memoria inicial: heap=${Math.round(initialMem.heapUsed / 1024 / 1024)}MB/${Math.round(initialMem.heapTotal / 1024 / 1024)}MB`,
  );

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
    'https://imec-del-norte-web.onrender.com',
    'https://imec-del-norte-sandbox.onrender.com',
    'https://imec-del-norte-backend.onrender.com',
    'https://m3h6rtnz-3032.use.devtunnels.ms',
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
      transformOptions: {
        enableImplicitConversion: true,
        excludeExtraneousValues: false,
      },
    }),
  );

  const port = configService.get<number>('PORT') || 3032;
  console.log(`🔧 Puerto configurado: ${port}`);
  console.log(`🔧 Entorno: ${process.env.NODE_ENV || 'development'}`);

  await app.listen(port);

  // Iniciar monitoreo después de que la app esté corriendo
  startMemoryMonitoring();

  // Exponer endpoint de health check
  console.log(`✅ Health check: http://localhost:${port}/api/health`);
}

bootstrap();
