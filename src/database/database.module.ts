import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseSeedService } from './database-seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  providers: [DatabaseSeedService],
  exports: [DatabaseSeedService],
})
export class DatabaseModule {}