import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator';

@ApiTags('health')
@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Health Check', description: 'Verifica el estado del servidor y la base de datos' })
  @ApiResponse({ status: 200, description: 'Servidor funcionando correctamente' })
  @ApiResponse({ status: 503, description: 'Servidor no disponible' })
  async checkHealth() {
    const health = await this.healthService.checkAll();
    
    if (health.status === 'ok') {
      return {
        status: 'OK',
        message: 'Sistema funcionando correctamente',
        timestamp: new Date().toISOString(),
        database: health.database,
        memory: health.memory,
        uptime: health.uptime,
      };
    } else {
      return {
        status: 'ERROR',
        message: 'Problemas detectados en el sistema',
        timestamp: new Date().toISOString(),
        database: health.database,
        memory: health.memory,
        uptime: health.uptime,
      };
    }
  }

  @Get('ping')
  @ApiOperation({ summary: 'Ping', description: 'Verificación simple de que el servidor está activo' })
  @ApiResponse({ status: 200, description: 'Pong' })
  ping() {
    return {
      message: 'pong',
      timestamp: new Date().toISOString(),
    };
  }
}