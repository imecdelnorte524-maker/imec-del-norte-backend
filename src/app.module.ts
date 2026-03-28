// src/app.module.ts (VERSIÓN CORREGIDA)
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import databaseConfig from './config/database.config';
import { DatabaseModule } from './database/database.module';
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
import { SequencesModule } from './database/sequences.module';
import { CommonModule } from './common/common.module';
import { PdfModule } from './pdf/pdf.module';
import { TechniciansModule } from './technicians/technicians.module';
import { RealtimeModule } from './realtime/realtime.module';
import { join } from 'path';
import { WoReportsModule } from './wo-reports/wo-reports.module';
@Module({
  imports: [
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    SequencesModule,
    PdfModule,
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

        const synchronize =
          configService.get<string>('TYPEORM_SYNCHRONIZE') === 'true' &&
          configService.get<string>('NODE_ENV') !== 'production';

        return {
          ...dbConfig,
          autoLoadEntities: true,
          synchronize,
          migrationsRun: false,
          migrationsTableName: 'migrations',
          migrations: [
            // soporta dist/migrations y dist/src/migrations según tu build
            join(__dirname, '..', 'migrations', '*{.js,.ts}'),
            join(__dirname, 'migrations', '*{.js,.ts}'),
          ],
          logging: ['error', 'warn'],
          extra: {
            ...(dbConfig as any).extra,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            maxUses: 7500,
          },
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
    CommonModule,
    TechniciansModule,
    RealtimeModule,
    WoReportsModule,
  ],
})
export class AppModule {}
