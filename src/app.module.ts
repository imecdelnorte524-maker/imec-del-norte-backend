import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import databaseConfig from './config/database.config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ServicesModule } from './services/services.module';
import { ToolModule } from './tools/tool.module';
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

@Module({
  imports: [
    ScheduleModule.forRoot(),

    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
      envFilePath: ['.env', '.env.local'],
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ...configService.get('database'),
      }),
    }),

    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    ServicesModule,
    ToolModule,
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
  ],
})
export class AppModule {}
