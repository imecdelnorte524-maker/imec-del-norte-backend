// src/database/sequences.module.ts
import { Module } from '@nestjs/common';
import { SequencesController } from './sequences.controller';
import { SequenceCheckerService } from './sequence-checker';

@Module({
  controllers: [SequencesController],
  providers: [SequenceCheckerService],
  exports: [SequenceCheckerService],
})
export class SequencesModule {}