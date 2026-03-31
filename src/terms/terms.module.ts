// src/modules/terms.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TermsConditions } from './entities/terms.entity';
import { TermsController } from './terms.controller';
import { TermsService } from './terms.service';

@Module({
  imports: [TypeOrmModule.forFeature([TermsConditions])],
  controllers: [TermsController],
  providers: [TermsService],
  exports: [TermsService],
})
export class TermsModule {}
