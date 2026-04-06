// src/sg-sst/sg-sst.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UsePipes,
  ValidationPipe,
  ParseIntPipe,
  NotFoundException,
  Res,
  BadRequestException,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { SgSstService } from './sg-sst.service';
import { CreateAtsDto } from './dto/create-ats.dto';
import { CreateHeightWorkDto } from './dto/create-height-work.dto';
import { CreatePreoperationalDto } from './dto/create-preoperational.dto';
import { SignFormDto, SignerType } from './dto/sign-form.dto';
import { ApiOperation } from '@nestjs/swagger';
import { AuthorizeHeightWorkDto } from './dto/authorize-height-work.dto';
import { CreatePreoperationalChecklistTemplateDto } from './dto/create-preoperational-checklist-template.dto';
import { FormStatus, FormType } from '../shared/index';
import { RejectFormDto } from './dto/reject-form.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('sg-sst')
@UsePipes(new ValidationPipe({ transform: true }))
@UseGuards(JwtAuthGuard)
export class SgSstController {
  constructor(private readonly sgSstService: SgSstService) { }

  private getReqMeta(req: Request) {
    const ip =
      (req.headers['x-forwarded-for'] as string) ||
      req.ip ||
      (req.socket && (req.socket as any).remoteAddress) ||
      '';
    const userAgent = (req.headers['user-agent'] as string) || '';
    const currentUser = (req as any).user ?? {};
    return { ip, userAgent, currentUser };
  }

  // ========== ENDPOINTS PARA CREAR FORMULARIOS ==========
  @Post('ats')
  async createAts(@Body() dto: CreateAtsDto, @Req() req: Request) {
    const { ip, userAgent, currentUser } = this.getReqMeta(req);

    // Seguridad: no confiar en userId/createdBy que vienen del front
    dto.userId = currentUser.userId;
    dto.createdBy = currentUser.userId;

    const result = await this.sgSstService.createAts(dto, ip, userAgent);
    return { success: true, message: 'ATS creado exitosamente', data: result };
  }

  @Post('height-work')
  async createHeightWork(@Body() dto: CreateHeightWorkDto, @Req() req: Request) {
    const { ip, userAgent, currentUser } = this.getReqMeta(req);

    dto.userId = currentUser.userId;
    dto.createdBy = currentUser.userId;

    const result = await this.sgSstService.createHeightWork(dto, ip, userAgent);
    return {
      success: true,
      message: 'Trabajo en alturas creado exitosamente',
      data: result,
    };
  }

  @Post('preoperational')
  async createPreoperational(
    @Body() dto: CreatePreoperationalDto,
    @Req() req: Request,
  ) {
    const { ip, userAgent, currentUser } = this.getReqMeta(req);

    dto.userId = currentUser.userId;
    dto.createdBy = currentUser.userId;

    const result = await this.sgSstService.createPreoperational(
      dto,
      ip,
      userAgent,
    );
    return {
      success: true,
      message: 'Checklist preoperacional creado exitosamente',
      data: result,
    };
  }

  // ========== ENDPOINTS PARA EDITAR (DRAFT al editar + obliga re-firma) ==========
  @Put('forms/:id/ats')
  @ApiOperation({ summary: 'Editar ATS (solo DRAFT/REJECTED). Resetea firmas y pasa a DRAFT.' })
  async updateAts(
    @Param('id', ParseIntPipe) formId: number,
    @Body() dto: CreateAtsDto,
    @Req() req: Request,
  ) {
    const { ip, userAgent, currentUser } = this.getReqMeta(req);

    dto.userId = currentUser.userId;
    dto.createdBy = currentUser.userId;

    const result = await this.sgSstService.updateAts(
      formId,
      dto,
      currentUser.userId,
      ip,
      userAgent,
    );
    return { success: true, message: 'ATS actualizado exitosamente', data: result };
  }

  @Put('forms/:id/height-work')
  @ApiOperation({ summary: 'Editar Trabajo en Alturas (solo DRAFT/REJECTED). Resetea firmas y pasa a DRAFT.' })
  async updateHeightWork(
    @Param('id', ParseIntPipe) formId: number,
    @Body() dto: CreateHeightWorkDto,
    @Req() req: Request,
  ) {
    const { ip, userAgent, currentUser } = this.getReqMeta(req);

    dto.userId = currentUser.userId;
    dto.createdBy = currentUser.userId;

    const result = await this.sgSstService.updateHeightWork(
      formId,
      dto,
      currentUser.userId,
      ip,
      userAgent,
    );
    return {
      success: true,
      message: 'Trabajo en alturas actualizado exitosamente',
      data: result,
    };
  }

  @Put('forms/:id/preoperational')
  @ApiOperation({ summary: 'Editar Preoperacional (solo DRAFT/REJECTED). Resetea firmas y pasa a DRAFT.' })
  async updatePreoperational(
    @Param('id', ParseIntPipe) formId: number,
    @Body() dto: CreatePreoperationalDto,
    @Req() req: Request,
  ) {
    const { ip, userAgent, currentUser } = this.getReqMeta(req);

    dto.userId = currentUser.userId;
    dto.createdBy = currentUser.userId;

    const result = await this.sgSstService.updatePreoperational(
      formId,
      dto,
      currentUser.userId,
      ip,
      userAgent,
    );
    return {
      success: true,
      message: 'Checklist preoperacional actualizado exitosamente',
      data: result,
    };
  }

  // ========== OTP PARA FIRMA ==========
  @Post('forms/:id/request-sign-otp')
  @ApiOperation({
    summary: 'Solicitar código OTP por correo para firmar un formulario',
  })
  async requestSignOtp(
    @Param('id', ParseIntPipe) formId: number,
    @Body() body: { signerType: SignerType },
    @Req() req: Request,
  ) {
    try {
      const currentUser = (req as any).user ?? {};
      await this.sgSstService.requestSignOtp(
        formId,
        body.signerType,
        currentUser.userId,
      );

      return {
        success: true,
        message:
          'Si el correo está registrado, se ha enviado un código de verificación',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al solicitar código OTP',
        error: (error as any).message,
      };
    }
  }

  // ========== ENDPOINTS PARA FIRMAR ==========
  @Post('forms/:id/sign')
  async signForm(
    @Param('id', ParseIntPipe) formId: number,
    @Body() signFormDto: SignFormDto,
    @Req() req: Request,
  ) {
    try {
      const currentUser = (req as any).user ?? {};

      const ip =
        (req.headers['x-forwarded-for'] as string) ||
        req.ip ||
        (req.socket && (req.socket as any).remoteAddress) ||
        '';
      const userAgent = (req.headers['user-agent'] as string) || '';

      const result = await this.sgSstService.signForm(
        formId,
        currentUser.userId,
        ip,
        userAgent,
        signFormDto,
      );

      let message = 'Firma registrada exitosamente';
      if (signFormDto.signerType === SignerType.TECHNICIAN) {
        message = 'Firma de técnico registrada. Pendiente firma SST';
      } else if (signFormDto.signerType === SignerType.SST) {
        message =
          'Firma de SST registrada. Formulario completado y PDF generado';
      }

      return {
        success: true,
        message,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al firmar formulario',
        error: (error as any).message,
      };
    }
  }

  @Post('forms/:id/authorize-height-work')
  @ApiOperation({
    summary: 'Autorizar un Trabajo en Alturas por parte del personal SST (legacy)',
  })
  async authorizeHeightWork(
    @Param('id', ParseIntPipe) formId: number,
    @Body() authorizeHeightWorkDto: AuthorizeHeightWorkDto,
  ) {
    try {
      const result = await this.sgSstService.authorizeHeightWork(
        formId,
        authorizeHeightWorkDto,
      );

      return {
        success: true,
        message: 'Trabajo en Alturas autorizado exitosamente',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al autorizar trabajo en alturas',
        error: (error as any).message,
      };
    }
  }

  @Get('forms/:id/download-pdf')
  async downloadPdf(
    @Param('id', ParseIntPipe) formId: number,
    @Res() res: Response,
  ) {
    try {
      const { buffer, fileName, fileSize } =
        await this.sgSstService.getFormPdf(formId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName}"`,
      );
      res.setHeader('Content-Length', fileSize.toString());

      return res.end(buffer);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Error al descargar PDF',
        error: (error as any).message,
      });
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
        count: forms.length,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al obtener formularios',
        error: (error as any).message,
      };
    }
  }

  @Get('forms/:id')
  async findFormById(@Param('id', ParseIntPipe) id: number) {
    try {
      const form = await this.sgSstService.findFormById(id);
      return {
        success: true,
        data: form,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          success: false,
          message: 'Formulario no encontrado',
          error: (error as any).message,
        };
      }
      return {
        success: false,
        message: 'Error al obtener formulario',
        error: (error as any).message,
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
        count: forms.length,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al obtener formularios por estado',
        error: (error as any).message,
      };
    }
  }

  @Get('forms/type/:type')
  async getFormsByType(@Param('type') type: FormType) {
    try {
      const forms = await this.sgSstService.findAllForms();
      const filteredForms = forms.filter((form) => form.formType === type);

      return {
        success: true,
        data: filteredForms,
        count: filteredForms.length,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al obtener formularios por tipo',
        error: (error as any).message,
      };
    }
  }

  // ========== ENDPOINTS DE UTILIDAD ==========
  @Get('forms/:id/can-edit')
  async canEditForm(
    @Param('id', ParseIntPipe) formId: number,
    @Query('userId', ParseIntPipe) userId: number,
  ) {
    try {
      const canEdit = await this.sgSstService.canEditForm(formId, userId);
      return {
        success: true,
        canEdit,
        message: canEdit
          ? 'El formulario puede ser editado'
          : 'El formulario no puede ser editado',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al verificar permisos de edición',
        error: (error as any).message,
      };
    }
  }

  // ========== PREOPERATIONAL TEMPLATES ==========
  @Post('preoperational-templates')
  @ApiOperation({
    summary:
      'Crear plantilla de checklist preoperacional para un tipo de herramienta',
  })
  async createPreoperationalTemplate(
    @Body()
    dto: CreatePreoperationalChecklistTemplateDto,
  ) {
    try {
      const template =
        await this.sgSstService.createPreoperationalChecklistTemplate(dto);

      return {
        success: true,
        message: 'Plantilla preoperacional creada exitosamente',
        data: template,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al crear plantilla preoperacional',
        error: (error as any).message,
      };
    }
  }

  @Put('preoperational-templates/:id')
  @ApiOperation({
    summary: 'Actualizar plantilla de checklist preoperacional (crea nueva versión y desactiva la anterior)',
  })
  async updatePreoperationalTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreatePreoperationalChecklistTemplateDto,
  ) {
    try {
      const template =
        await this.sgSstService.updatePreoperationalChecklistTemplate(id, dto);

      return {
        success: true,
        message: 'Plantilla preoperacional actualizada exitosamente',
        data: template,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al actualizar plantilla preoperacional',
        error: (error as any).message,
      };
    }
  }

  @Get('preoperational-templates/by-tool-type')
  async getPreoperationalTemplateByToolType(
    @Query('toolType') toolType: string,
  ) {
    if (!toolType) {
      throw new BadRequestException('El parámetro toolType es requerido');
    }

    const template =
      await this.sgSstService.getPreoperationalChecklistByToolType(toolType);

    return {
      success: true,
      data: template,
    };
  }

  // ========== RECHAZAR FORMULARIO ==========
  @Post('forms/:id/reject')
  @ApiOperation({
    summary: 'Rechazar un formulario SG-SST como SST',
  })
  async rejectForm(
    @Param('id', ParseIntPipe) formId: number,
    @Body() rejectFormDto: RejectFormDto,
  ) {
    try {
      const result = await this.sgSstService.rejectForm(formId, rejectFormDto);

      return {
        success: true,
        message: 'Formulario rechazado exitosamente',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al rechazar formulario',
        error: (error as any).message,
      };
    }
  }

  // ========== DASHBOARD ==========
  @Get('dashboard/stats')
  async getDashboardStats(@Query('userId') userId?: number) {
    try {
      const forms = await this.sgSstService.findAllForms(userId);

      const stats = {
        total: forms.length,
        draft: forms.filter((f) => f.status === FormStatus.DRAFT).length,
        pendingSst: forms.filter((f) => f.status === FormStatus.PENDING_SST)
          .length,
        completed: forms.filter((f) => f.status === FormStatus.COMPLETED)
          .length,
        rejected: forms.filter((f) => f.status === FormStatus.REJECTED).length,
        byType: {
          ats: forms.filter((f) => f.formType === FormType.ATS).length,
          heightWork: forms.filter((f) => f.formType === FormType.HEIGHT_WORK)
            .length,
          preoperational: forms.filter(
            (f) => f.formType === FormType.PREOPERATIONAL,
          ).length,
        },
      };

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al obtener estadísticas',
        error: (error as any).message,
      };
    }
  }

  // ========== CATALOGS ==========
  @Get('catalogs/ats')
  async getAtsCatalogs() {
    return {
      success: true,
      data: await this.sgSstService.getAtsCatalogs(),
    };
  }

  @Post('catalogs/ats/risk-categories')
  async createAtsRiskCategory(
    @Body() dto: { code: string; name: string; displayOrder?: number },
    @Req() req: Request,
  ) {
    const currentUser = (req as any).user ?? {};
    return {
      success: true,
      data: await this.sgSstService.createAtsRiskCategory(
        currentUser.userId,
        dto,
      ),
    };
  }

  @Post('catalogs/ats/risks')
  async createAtsRisk(
    @Body()
    dto: {
      categoryId: number;
      name: string;
      description?: string;
      displayOrder?: number;
    },
    @Req() req: Request,
  ) {
    const currentUser = (req as any).user ?? {};
    return {
      success: true,
      data: await this.sgSstService.createAtsRisk(currentUser.userId, dto),
    };
  }

  @Post('catalogs/ats/ppe-items')
  async createAtsPpeItem(
    @Body() dto: { name: string; type?: string; displayOrder?: number },
    @Req() req: Request,
  ) {
    const currentUser = (req as any).user ?? {};
    return {
      success: true,
      data: await this.sgSstService.createAtsPpeItem(currentUser.userId, dto),
    };
  }

  @Get('catalogs/heights')
  async getHeightsCatalogs() {
    return {
      success: true,
      data: await this.sgSstService.getHeightsCatalogs(),
    };
  }

  @Post('catalogs/heights/protection-elements')
  async createHeightProtectionElement(
    @Body() dto: { name: string; displayOrder?: number },
    @Req() req: Request,
  ) {
    const currentUser = (req as any).user ?? {};
    return {
      success: true,
      data: await this.sgSstService.createHeightProtectionElement(
        currentUser.userId,
        dto,
      ),
    };
  }
}