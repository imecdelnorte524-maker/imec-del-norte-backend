// src/technicians/technician-ranking.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TechnicianRankingService } from './technician-ranking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('technician-ranking')
@Controller('technician-ranking')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TechnicianRankingController {
  constructor(private readonly rankingService: TechnicianRankingService) {}

  private getRoleName(user: any): string {
    return user?.role?.nombreRol || user?.role || '';
  }

  @Get('current')
  @ApiOperation({ summary: 'Obtener ranking actual del mes para dashboard' })
  async getCurrentRanking(@Req() req: any) {
    const ranking = await this.rankingService.getCurrentMonthRanking(req.user);

    return {
      message: 'Ranking de técnicos obtenido exitosamente',
      data: {
        mes: ranking.mes,
        año: ranking.año,
        fechaCalculo: ranking.fechaCalculo,
        topTecnicos: ranking.ranking,
        totalTecnicosEnRanking: ranking.totalTecnicos,
      },
    };
  }

  @Get('monthly')
  @ApiOperation({ summary: 'Obtener ranking de un mes específico' })
  @ApiQuery({ name: 'mes', type: Number, required: true })
  @ApiQuery({ name: 'año', type: Number, required: true })
  @ApiQuery({ name: 'forceRecalculate', type: Boolean, required: false })
  async getMonthlyRanking(
    @Req() req: any,
    @Query('mes', ParseIntPipe) mes: number,
    @Query('año', ParseIntPipe) año: number,
    @Query('forceRecalculate') forceRecalculate?: string,
  ) {
    const force = forceRecalculate === 'true';
    const ranking = await this.rankingService.getMonthlyRankingWithCache(
      mes,
      año,
      req.user,
      force,
    );

    return {
      message: `Ranking de técnicos para ${mes}/${año} obtenido exitosamente`,
      data: ranking,
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Obtener estadísticas globales del ranking' })
  async getRankingStats(@Req() req: any) {
    const stats = await this.rankingService.getRankingStats(req.user);

    return {
      message: 'Estadísticas de ranking obtenidas exitosamente',
      data: stats,
    };
  }

  @Get('technician/:tecnicoId/evolution')
  @ApiOperation({ summary: 'Obtener evolución histórica de un técnico' })
  @ApiQuery({ name: 'meses', type: Number, required: false })
  async getTechnicianEvolution(
    @Req() req: any,
    @Param('tecnicoId', ParseIntPipe) tecnicoId: number,
    @Query('meses', ParseIntPipe) meses: number = 6,
  ) {
    const roleName = this.getRoleName(req.user);
    const userId = req.user?.userId;

    // Si es técnico, solo puede ver su propia evolución
    if (roleName === 'Técnico' && userId !== tecnicoId) {
      const evolution = await this.rankingService.getTechnicianEvolution(
        userId,
        meses,
      );
      return {
        message: 'Evolución del técnico obtenida exitosamente',
        data: evolution,
      };
    }

    const evolution = await this.rankingService.getTechnicianEvolution(
      tecnicoId,
      meses,
    );

    return {
      message: 'Evolución del técnico obtenida exitosamente',
      data: evolution,
    };
  }

  @Get('historical')
   
  @ApiOperation({ summary: 'Obtener ranking histórico con paginación' })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({ name: 'mes', type: Number, required: false })
  @ApiQuery({ name: 'año', type: Number, required: false })
  @ApiQuery({ name: 'tecnicoId', type: Number, required: false })
  async getHistoricalRanking(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('mes') mes?: number,
    @Query('año') año?: number,
    @Query('tecnicoId') tecnicoId?: number,
  ) {
    const result = await this.rankingService.getHistoricalRanking({
      page: page ? parseInt(page as any) : undefined,
      limit: limit ? parseInt(limit as any) : undefined,
      mes: mes ? parseInt(mes as any) : undefined,
      año: año ? parseInt(año as any) : undefined,
      tecnicoId: tecnicoId ? parseInt(tecnicoId as any) : undefined,
    });

    return {
      message: 'Ranking histórico obtenido exitosamente',
      data: result,
    };
  }

  @Get('top/:category')
   
  @ApiOperation({ summary: 'Obtener mejores técnicos por categoría' })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({ name: 'mes', type: Number, required: false })
  @ApiQuery({ name: 'año', type: Number, required: false })
  async getTopByCategory(
    @Param('category')
    category: 'calificacion' | 'productividad' | 'puntualidad',
    @Query('limit') limit?: number,
    @Query('mes') mes?: number,
    @Query('año') año?: number,
  ) {
    const top = await this.rankingService.getTopTechniciansByCategory(
      category,
      limit ? parseInt(limit as any) : 5,
      mes ? parseInt(mes as any) : undefined,
      año ? parseInt(año as any) : undefined,
    );

    return {
      message: `Top técnicos por ${category} obtenido exitosamente`,
      data: top,
    };
  }

  @Post('recalculate/:mes/:año')
   
  @ApiOperation({
    summary: 'Forzar recálculo del ranking para un mes específico',
  })
  async recalculateRanking(
    @Param('mes', ParseIntPipe) mes: number,
    @Param('año', ParseIntPipe) año: number,
  ) {
    const ranking = await this.rankingService.calculateMonthlyRanking(
      mes,
      año,
      null,
      true,
    );

    return {
      message: `Ranking recalculado exitosamente para ${mes}/${año}`,
      data: ranking,
    };
  }
}
