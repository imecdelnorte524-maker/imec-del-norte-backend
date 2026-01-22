import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabaseSeed } from './seed/database.seed';

@Injectable()
export class DatabaseSeedService implements OnApplicationBootstrap {
  constructor(private dataSource: DataSource) {}

  async onApplicationBootstrap() {
    if (process.env.RUN_SEED === 'true' && process.env.NODE_ENV !== 'production') {
      console.log('🚀 Ejecutando seeder automático...');
      const seeder = new DatabaseSeed(this.dataSource);
      await seeder.seed();
    }
  }

  async runSeedManually() {
    console.log('🚀 Ejecutando seeder manualmente...');
    const seeder = new DatabaseSeed(this.dataSource);
    await seeder.seed();
  }
}