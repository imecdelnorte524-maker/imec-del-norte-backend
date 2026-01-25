import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

import databaseConfig from './config/database.config';
// No importamos dataSource aquí para evitar que cargue las migraciones conflictivas

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ServicesModule } from './services/services.module';
import { ToolsModule } from './tools/tool.module';
import { SuppliesModule } from './supplies/supplies.module';
import { InventoryModule } from './inventory/inventory.module';
import { WorkOrdersModule } from './work-orders/work-orders.module';
import { HealthModule } from './common/health/health.module';
import { SgSstModule } from './sg-sst/sg-sst.module';
import { RolesModule } from './roles/roles.module';
import { ClientModule } from './client/client.module';
import { AreaModule } from './area/area.module';
import { SubAreaModule } from './sub-area/sub-area.module';
import { MailModule } from './mail/mail.module';
import { TasksModule } from './tasks/tasks.module';
import { EquipmentModule } from './equipment/equipment.module';
import { ImagesModule } from './images/images.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AirConditionerTypesModule } from './air-conditioner-types/air-conditioner-type.module';
import { ModulesModule } from './modules/modules.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { UnitMeasureModule } from './unit-measure/unit-measure.module';
import { MaintenanceTypesModule } from './maintenance-types/maintenance-types.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),

    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
      envFilePath: ['.env', '.env.local'],
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.get('database');
        
        return {
          ...dbConfig,
          // IMPORTANTE: Dejamos el arreglo vacío para que NO cargue migraciones al bootear
          migrations: [], 
          // Desactivamos la ejecución automática
          migrationsRun: false,
          // ACTIVAMOS synchronize para que cree las tablas solo basándose en las @Entity()
          synchronize: true,
          autoLoadEntities: true,
          // Cambiamos el nombre de la tabla de control para evitar colisiones
          migrationsTableName: 'migrations_manual_log',
          logging: ['error', 'warn'], 
        };
      },
    }),

    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    ServicesModule,
    ToolsModule,
    SuppliesModule,
    InventoryModule,
    WorkOrdersModule,
    SgSstModule,
    ClientModule,
    AreaModule,
    SubAreaModule,
    MailModule,
    TasksModule,
    EquipmentModule,
    ImagesModule,
    DashboardModule,
    NotificationsModule,
    AirConditionerTypesModule,
    ModulesModule,
    WarehousesModule,
    UnitMeasureModule,
    MaintenanceTypesModule,
  ],
})
export class AppModule {}