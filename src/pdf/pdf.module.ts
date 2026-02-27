// src/pdf/pdf.module.ts
import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';

@Module({
  imports: [ConfigModule],
  controllers: [PdfController],
  providers: [PdfService],
  exports: [PdfService], 
})
export class PdfModule {}
