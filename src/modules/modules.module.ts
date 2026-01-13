import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';
import { Module as ModuleEntity } from './entities/module.entity'; // Renombramos para evitar conflicto con @nestjs/common Module
import { RolesModule } from '../roles/roles.module'; // Importa el RolesModule para usar RolesService

@Module({
  imports: [
    TypeOrmModule.forFeature([ModuleEntity]), // Importa la entidad ModuleEntity
    RolesModule, // Importa RolesModule para que ModulesService pueda usar RolesService
  ],
  controllers: [ModulesController],
  providers: [ModulesService],
  exports: [ModulesService], // Exporta ModulesService si otros módulos lo van a usar
})
export class ModulesModule {}