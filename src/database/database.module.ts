import { Module, Global } from '@nestjs/common';
import { SequenceCheckerService } from './sequence-checker';

@Global()
@Module({
  imports: [],
  providers: [SequenceCheckerService],
  exports: [SequenceCheckerService],
})
export class DatabaseModule {}