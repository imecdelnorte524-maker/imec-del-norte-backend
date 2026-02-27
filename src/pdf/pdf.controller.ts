// src/pdf/pdf.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Res,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { PdfService } from './pdf.service';
import { GeneratePdfDto } from './dto/generate-pdf.dto';

@ApiTags('pdf')
@Controller('pdf')
export class PdfController {
  private readonly logger = new Logger(PdfController.name);

  constructor(private readonly pdfService: PdfService) {} // ✅ SOLO PdfService

  @Post('generate')
  @ApiOperation({ summary: 'Generar PDF desde template' })
  @ApiBody({ type: GeneratePdfDto })
  @ApiResponse({ status: 200, content: { 'application/pdf': {} } })
  async generatePdf(@Body() dto: GeneratePdfDto, @Res() res: Response) {
    try {
      const pdfBuffer = await this.pdfService.generatePdf(dto);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${dto.templateName}.pdf"`,
      );
      res.setHeader('Content-Length', pdfBuffer.length);

      return res.status(HttpStatus.OK).send(pdfBuffer);
    } catch (error) {
      this.logger.error(`Error: ${error.message}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: error.message,
      });
    }
  }

  @Get('test')
  @ApiOperation({ summary: 'PDF de prueba' })
  async generateTestPdf(@Res() res: Response) {
    try {
      const pdfBuffer = await this.pdfService.generatePdf({
        templateName: 'test',
        params: { NAME: 'Test', DATE: new Date().toLocaleDateString() },
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="test.pdf"');
      return res.status(HttpStatus.OK).send(pdfBuffer);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: error.message,
      });
    }
  }
}
