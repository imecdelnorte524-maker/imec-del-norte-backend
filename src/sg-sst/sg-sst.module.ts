import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SgSstController } from './sg-sst.controller';
import { SgSstService } from './sg-sst.service';
import { Form } from './entities/form.entity';
import { AtsReport } from './entities/ats-report.entity';
import { HeightWork } from './entities/height-work.entity';
import { PreoperationalCheck } from './entities/preoperational-check.entity';
import { Signature } from './entities/signature.entity';
import { GeneratedPdf } from './entities/generated-pdf.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { PreoperationalChecklistTemplate } from './entities/preoperational-checklist-template.entity';
import { PreoperationalChecklistParameter } from './entities/preoperational-checklist-parameter.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Form,
      AtsReport,
      HeightWork,
      PreoperationalCheck,
      Signature,
      GeneratedPdf,
      WorkOrder,
      PreoperationalChecklistTemplate,
      PreoperationalChecklistParameter
    ]),
  ],
  controllers: [SgSstController],
  providers: [SgSstService],
  exports: [SgSstService],
})
export class SgSstModule {}