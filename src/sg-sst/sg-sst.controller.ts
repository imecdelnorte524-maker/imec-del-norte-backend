import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UsePipes,
  ValidationPipe,
  ParseIntPipe,
  NotFoundException
} from '@nestjs/common';
import { SgSstService } from './sg-sst.service';
import { CreateAtsDto } from './dto/create-ats.dto';
import { CreateHeightWorkDto } from './dto/create-height-work.dto';
import { CreatePreoperationalDto } from './dto/create-preoperational.dto';
import { SignFormDto, SignerType } from './dto/sign-form.dto';
import { FormStatus, FormType } from './entities/form.entity';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateAtsWithSignatureDto } from './dto/create-ats-with-signature.dto';
import { CreatePreoperationalWithSignatureDto } from './dto/create-preoperational-with-signature.dto';
import { CreateHeightWorkWithSignatureDto } from './dto/create-height-work-with-signature.dto';
import { AuthorizeHeightWorkDto } from './dto/authorize-height-work.dto';

@Controller('sg-sst')
@UsePipes(new ValidationPipe({ transform: true }))
export class SgSstController {
  constructor(private readonly sgSstService: SgSstService) { }

  // ========== ENDPOINTS PARA CREAR FORMULARIOS ==========

  @Post('ats')
  async createAts(@Body() createAtsDto: CreateAtsDto) {
    try {
      const result = await this.sgSstService.createAts(createAtsDto);
      return {
        success: true,
        message: 'ATS creado exitosamente',
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al crear ATS',
        error: error.message
      };
    }
  }

  @Post('height-work')
  async createHeightWork(@Body() createHeightWorkDto: CreateHeightWorkDto) {
    try {
      const result = await this.sgSstService.createHeightWork(createHeightWorkDto);
      return {
        success: true,
        message: 'Trabajo en alturas creado exitosamente',
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al crear trabajo en alturas',
        error: error.message
      };
    }
  }

  @Post('preoperational')
  async createPreoperational(@Body() createPreoperationalDto: CreatePreoperationalDto) {
    try {
      const result = await this.sgSstService.createPreoperational(createPreoperationalDto);
      return {
        success: true,
        message: 'Checklist preoperacional creado exitosamente',
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al crear checklist preoperacional',
        error: error.message
      };
    }
  }

  // ========== ENDPOINTS PARA FIRMAR ==========

  @Post('forms/:id/sign')
  async signForm(
    @Param('id', ParseIntPipe) formId: number,
    @Body() signFormDto: SignFormDto
  ) {
    try {
      const result = await this.sgSstService.signForm(formId, signFormDto);

      let message = 'Firma registrada exitosamente';
      if (signFormDto.signerType === SignerType.TECHNICIAN) {
        message = 'Firma de técnico registrada. Pendiente firma SST';
      } else if (signFormDto.signerType === SignerType.SST) {
        message = 'Firma de SST registrada. Formulario completado y PDF generado';
      }

      return {
        success: true,
        message,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al firmar formulario',
        error: error.message
      };
    }
  }

  @Post('forms/:id/authorize-height-work')
  @ApiOperation({ summary: 'Autorizar un Trabajo en Alturas por parte del personal SST' })
  async authorizeHeightWork(
    @Param('id', ParseIntPipe) formId: number,
    @Body() authorizeHeightWorkDto: AuthorizeHeightWorkDto
  ) {
    try {
      const result = await this.sgSstService.authorizeHeightWork(formId, authorizeHeightWorkDto);

      return {
        success: true,
        message: 'Trabajo en Alturas autorizado exitosamente',
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al autorizar trabajo en alturas',
        error: error.message
      };
    }
  }

  // ========== ENDPOINTS PARA CONSULTAS ==========

  @Get('forms')
  async findAllForms(@Query('userId') userId?: number) {
    try {
      const forms = await this.sgSstService.findAllForms(userId);
      return {
        success: true,
        data: forms,
        count: forms.length
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al obtener formularios',
        error: error.message
      };
    }
  }

  @Get('forms/:id')
  async findFormById(@Param('id', ParseIntPipe) id: number) {
    try {
      const form = await this.sgSstService.findFormById(id);
      return {
        success: true,
        data: form
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          success: false,
          message: 'Formulario no encontrado',
          error: error.message
        };
      }
      return {
        success: false,
        message: 'Error al obtener formulario',
        error: error.message
      };
    }
  }

  @Get('forms/status/:status')
  async getFormsByStatus(@Param('status') status: FormStatus) {
    try {
      const forms = await this.sgSstService.getFormsByStatus(status);
      return {
        success: true,
        data: forms,
        count: forms.length
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al obtener formularios por estado',
        error: error.message
      };
    }
  }

  @Get('forms/type/:type')
  async getFormsByType(@Param('type') type: FormType) {
    try {
      const forms = await this.sgSstService.findAllForms();
      const filteredForms = forms.filter(form => form.formType === type);

      return {
        success: true,
        data: filteredForms,
        count: filteredForms.length
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al obtener formularios por tipo',
        error: error.message
      };
    }
  }

  // ========== ENDPOINTS DE UTILIDAD ==========

  @Get('forms/:id/can-edit')
  async canEditForm(
    @Param('id', ParseIntPipe) formId: number,
    @Query('userId', ParseIntPipe) userId: number
  ) {
    try {
      const canEdit = await this.sgSstService.canEditForm(formId, userId);
      return {
        success: true,
        canEdit,
        message: canEdit ? 'El formulario puede ser editado' : 'El formulario no puede ser editado'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al verificar permisos de edición',
        error: error.message
      };
    }
  }

  @Post('forms/:id/generate-pdf')
  async generatePdf(@Param('id', ParseIntPipe) formId: number) {
    try {
      const pdf = await this.sgSstService.generatePdf(formId);
      return {
        success: true,
        message: 'PDF generado exitosamente',
        data: {
          fileName: pdf.fileName,
          filePath: pdf.filePath,
          fileSize: pdf.fileSize,
          generatedAt: pdf.generatedAt
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al generar PDF',
        error: error.message
      };
    }
  }

  // ========== ENDPOINTS DE ESTADÍSTICAS ==========

  @Get('dashboard/stats')
  async getDashboardStats(@Query('userId') userId?: number) {
    try {
      const forms = await this.sgSstService.findAllForms(userId);

      const stats = {
        total: forms.length,
        draft: forms.filter(f => f.status === FormStatus.DRAFT).length,
        pendingSst: forms.filter(f => f.status === FormStatus.PENDING_SST).length,
        completed: forms.filter(f => f.status === FormStatus.COMPLETED).length,
        byType: {
          ats: forms.filter(f => f.formType === FormType.ATS).length,
          heightWork: forms.filter(f => f.formType === FormType.HEIGHT_WORK).length,
          preoperational: forms.filter(f => f.formType === FormType.PREOPERATIONAL).length,
        }
      };

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al obtener estadísticas',
        error: error.message
      };
    }
  }

  // En src/sg-sst/sg-sst.controller.ts - Añadir este endpoint
  @Post('ats-with-signature')
  @ApiOperation({ summary: 'Crear un ATS completo incluyendo la firma del trabajador' })
  @ApiResponse({
    status: 201,
    description: 'ATS creado y firmado exitosamente',
    schema: {
      example: {
        success: true,
        message: 'ATS creado y firmado exitosamente',
        data: {
          form: {
            id: 1,
            formType: 'ATS',
            status: 'PENDING_SST',
            userId: 1,
            createdBy: 1,
            technicianSignatureDate: '2024-01-15T10:30:00.000Z',
            createdAt: '2024-01-15T10:30:00.000Z',
            updatedAt: '2024-01-15T10:30:00.000Z'
          },
          ats: {
            id: 1,
            formId: 1,
            workerName: 'Juan Pérez García',
            position: 'Técnico Electricista',
            area: 'Electricidad',
            workToPerform: 'Instalación de sistema eléctrico',
            location: 'Edificio Principal - Piso 3',
            startTime: '08:00',
            endTime: '17:00',
            date: '2024-01-15',
            observations: 'Trabajo en área confinada',
            selectedRisks: { fisicos: ['ruido'], quimicos: ['vapores'] },
            requiredPpe: { cascos: 1, guantes: 2 },
            createdAt: '2024-01-15T10:30:00.000Z'
          },
          signature: {
            id: 1,
            formId: 1,
            signatureType: 'TECHNICIAN',
            userId: 1,
            userName: 'Juan Pérez García',
            signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
            signedAt: '2024-01-15T10:30:00.000Z'
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Error en los datos de entrada'
  })
  async createAtsWithSignature(@Body() createAtsWithSignatureDto: CreateAtsWithSignatureDto) {
    try {
      const result = await this.sgSstService.createAtsWithSignature(createAtsWithSignatureDto);

      let message = 'ATS creado exitosamente';
      if (createAtsWithSignatureDto.signerType === SignerType.TECHNICIAN) {
        message = 'ATS creado y firmado por el técnico. Pendiente firma SST';
      } else if (createAtsWithSignatureDto.signerType === SignerType.SST) {
        message = 'ATS creado y firmado por SST. Formulario completado';
      }

      return {
        success: true,
        message,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al crear ATS con firma',
        error: error.message
      };
    }
  }

  @Post('height-work-with-signature')
  @ApiOperation({ summary: 'Crear un Trabajo en Alturas completo incluyendo firma' })
  async createHeightWorkWithSignature(@Body() createHeightWorkWithSignatureDto: CreateHeightWorkWithSignatureDto) {
    try {
      const result = await this.sgSstService.createHeightWorkWithSignature(createHeightWorkWithSignatureDto);

      let message = 'Trabajo en alturas creado exitosamente';
      if (createHeightWorkWithSignatureDto.signerType === SignerType.TECHNICIAN) {
        message = 'Trabajo en alturas creado y firmado por el técnico. Pendiente firma SST';
      } else if (createHeightWorkWithSignatureDto.signerType === SignerType.SST) {
        message = 'Trabajo en alturas creado y firmado por SST. Formulario completado';
      }

      return {
        success: true,
        message,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al crear trabajo en alturas con firma',
        error: error.message
      };
    }
  }

  @Post('preoperational-with-signature')
  @ApiOperation({ summary: 'Crear un Checklist Preoperacional completo incluyendo firma' })
  async createPreoperationalWithSignature(@Body() createPreoperationalWithSignatureDto: CreatePreoperationalWithSignatureDto) {
    try {
      const result = await this.sgSstService.createPreoperationalWithSignature(createPreoperationalWithSignatureDto);

      let message = 'Checklist preoperacional creado exitosamente';
      if (createPreoperationalWithSignatureDto.signerType === SignerType.TECHNICIAN) {
        message = 'Checklist preoperacional creado y firmado por el técnico. Pendiente firma SST';
      } else if (createPreoperationalWithSignatureDto.signerType === SignerType.SST) {
        message = 'Checklist preoperacional creado y firmado por SST. Formulario completado';
      }

      return {
        success: true,
        message,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al crear checklist preoperacional con firma',
        error: error.message
      };
    }
  }
}