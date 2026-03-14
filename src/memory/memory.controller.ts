// src/memory/memory.controller.ts
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/memory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Get('stats')
  getStats() {
    return this.memoryService.getStats();
  }

  @Post('gc')
  forceGC() {
    return this.memoryService.forceGC();
  }
}