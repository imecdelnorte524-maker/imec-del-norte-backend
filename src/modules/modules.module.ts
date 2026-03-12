import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';
import { Module as ModuleEntity } from './entities/module.entity'; 
import { RolesModule } from '../roles/roles.module';
import { RealtimeModule } from '../realtime/realtime.module';
 

@Module({
  imports: [
    TypeOrmModule.forFeature([ModuleEntity]),
    RolesModule,
    RealtimeModule,
  ],
  controllers: [ModulesController],
  providers: [ModulesService],
  exports: [ModulesService],
})
export class ModulesModule {}