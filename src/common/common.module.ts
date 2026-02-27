// src/common/common.module.ts
import { Global, Module } from '@nestjs/common';
import { SequenceHelperService } from './services/sequence-helper.service';

@Global()
@Module({
  providers: [SequenceHelperService],
  exports: [SequenceHelperService],
})
export class CommonModule {}