// src/sg-sst/sg-sst.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SgSstService } from './sg-sst.service';
import { SgSstController } from './sg-sst.controller';
import { Form } from './entities/form.entity';
import { AtsReport } from './entities/ats-report.entity';
import { HeightWork } from './entities/height-work.entity';
import { PreoperationalCheck } from './entities/preoperational-check.entity';
import { Signature } from './entities/signature.entity';
import { SignOtp } from './entities/sign-otp.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { PreoperationalChecklistTemplate } from './entities/preoperational-checklist-template.entity';
import { PreoperationalChecklistParameter } from './entities/preoperational-checklist-parameter.entity';
 
import { PdfModule } from '../pdf/pdf.module';
import { User } from '../users/entities/user.entity';
import { MailModule } from '../mail/mail.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Form,
      AtsReport,
      HeightWork,
      PreoperationalCheck,
      Signature,
      SignOtp,
      WorkOrder,
      PreoperationalChecklistTemplate,
      PreoperationalChecklistParameter,
      User,
    ]),
    RealtimeModule,
    PdfModule,
    MailModule,
  ],
  controllers: [SgSstController],
  providers: [SgSstService],
})
export class SgSstModule {}
