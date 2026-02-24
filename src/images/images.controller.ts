import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UploadedFiles,
  UploadedFile,
  UseInterceptors,
  ParseIntPipe,
  Body,
} from '@nestjs/common';
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiConsumes,
  ApiBody,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { ImagesService } from './images.service';
import { UploadImageSwaggerDto } from './dto/upload-image.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { WorkOrderEvidencePhase } from 'src/shared/index';

@ApiTags('Images')
@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  // ---------- HERRAMIENTAS ----------
  @Post('tool/:id')
  @ApiOperation({ summary: 'Subir o reemplazar imágenes de una herramienta' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Imágenes subidas correctamente' })
  @ApiResponse({ status: 404, description: 'Herramienta no encontrada' })
  @UseInterceptors(FilesInterceptor('files', 10))
  uploadToolImages(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.imagesService.uploadForTool(id, files);
  }

  @Get('tool/:id')
  @ApiOperation({ summary: 'Obtener imágenes de una herramienta' })
  @ApiResponse({
    status: 200,
    description: 'Imágenes obtenidas correctamente',
  })
  @ApiResponse({ status: 404, description: 'Herramienta no encontrada' })
  async getToolImages(@Param('id', ParseIntPipe) id: number) {
    const images = await this.imagesService.getToolImages(id);
    return {
      message: 'Imágenes de herramienta obtenidas',
      data: images,
    };
  }

  // ---------- INSUMOS ----------
  @Post('supply/:id')
  @ApiOperation({ summary: 'Subir o reemplazar imágenes de un insumo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Imágenes subidas correctamente' })
  @ApiResponse({ status: 404, description: 'Insumo no encontrado' })
  @UseInterceptors(FilesInterceptor('files', 10))
  uploadSupplyImages(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.imagesService.uploadForSupply(id, files);
  }

  @Get('supply/:id')
  @ApiOperation({ summary: 'Obtener imágenes de un insumo' })
  @ApiResponse({
    status: 200,
    description: 'Imágenes obtenidas correctamente',
  })
  @ApiResponse({ status: 404, description: 'Insumo no encontrado' })
  async getSupplyImages(@Param('id', ParseIntPipe) id: number) {
    const images = await this.imagesService.getSupplyImages(id);
    return {
      message: 'Imágenes de insumo obtenidas',
      data: images,
    };
  }

  // ---------- EQUIPOS ----------
  @Post('equipment/:id')
  @ApiOperation({ summary: 'Subir imagen de un equipo (hoja de vida)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadImageSwaggerDto })
  @ApiResponse({ status: 201, description: 'Imagen subida correctamente' })
  @ApiResponse({ status: 404, description: 'Equipo no encontrado' })
  @UseInterceptors(FileInterceptor('file'))
  uploadEquipmentImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.imagesService.uploadForEquipment(id, file);
  }

  @Get('equipment/:id')
  @ApiOperation({ summary: 'Obtener imágenes de un equipo' })
  @ApiResponse({
    status: 200,
    description: 'Imágenes obtenidas correctamente',
  })
  @ApiResponse({ status: 404, description: 'Equipo no encontrado' })
  async getEquipmentImages(@Param('id', ParseIntPipe) id: number) {
    const images = await this.imagesService.getEquipmentImages(id);
    return {
      message: 'Imágenes de equipo obtenidas',
      data: images,
    };
  }

  @Delete('equipment/:id')
  @ApiOperation({ summary: 'Eliminar todas las imágenes de un equipo' })
  @ApiResponse({
    status: 200,
    description: 'Imágenes eliminadas correctamente',
  })
  deleteEquipmentImages(@Param('id', ParseIntPipe) id: number) {
    return this.imagesService.deleteByEquipment(id);
  }

  // ---------- CLIENTES ----------
  @Post('client/:id/logo')
  @ApiOperation({ summary: 'Subir o reemplazar logo de un cliente' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadImageSwaggerDto })
  @ApiResponse({ status: 201, description: 'Logo subido correctamente' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  @UseInterceptors(FileInterceptor('file'))
  uploadClientLogo(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.imagesService.uploadClientLogo(id, file);
  }

  @Post('client/:id')
  @ApiOperation({ summary: 'Subir imágenes a la galería de un cliente' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Imágenes subidas correctamente' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  @UseInterceptors(FilesInterceptor('files', 10))
  uploadClientImages(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.imagesService.uploadClientImages(id, files);
  }

  @Get('client/:id')
  @ApiOperation({
    summary: 'Obtener imágenes de un cliente (galería, sin logo)',
  })
  @ApiResponse({
    status: 200,
    description: 'Imágenes obtenidas correctamente',
  })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  async getClientImages(@Param('id', ParseIntPipe) id: number) {
    const images = await this.imagesService.getClientImages(id);
    return {
      message: 'Imágenes de cliente obtenidas',
      data: images,
    };
  }

  @Get('client/:id/logo')
  @ApiOperation({ summary: 'Obtener logo de un cliente' })
  @ApiResponse({
    status: 200,
    description: 'Logo obtenido correctamente',
  })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  async getClientLogo(@Param('id', ParseIntPipe) id: number) {
    const image = await this.imagesService.getClientLogo(id);
    return {
      message: 'Logo de cliente obtenido',
      data: image,
    };
  }

  @Delete('client/:id')
  @ApiOperation({
    summary: 'Eliminar todas las imágenes de un cliente',
  })
  @ApiResponse({
    status: 200,
    description: 'Imágenes eliminadas correctamente',
  })
  deleteClientImages(@Param('id', ParseIntPipe) id: number) {
    return this.imagesService.deleteByClient(id);
  }

  // ---------- ELIMINAR GENÉRICO POR ID ----------
  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar una imagen (Cloudinary + BD) por ID',
  })
  @ApiResponse({ status: 200, description: 'Imagen eliminada correctamente' })
  @ApiResponse({ status: 404, description: 'Imagen no encontrada' })
  deleteImage(@Param('id', ParseIntPipe) id: number) {
    return this.imagesService.deleteImage(id);
  }

  @Post('work-order/:id')
  @Roles('Administrador', 'Técnico', 'Secretaria', 'Supervisor')
  @ApiOperation({
    summary: 'Subir evidencias (imágenes) de una orden de trabajo',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
        phase: {
          type: 'string',
          enum: ['BEFORE', 'DURING', 'AFTER'],
          description:
            'Fase de la evidencia: BEFORE (antes), DURING (durante), AFTER (después)',
        },
        observation: {
          type: 'string',
          description: 'Observación para este conjunto de evidencias',
        },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files', 10))
  uploadWorkOrderImages(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: { phase?: WorkOrderEvidencePhase; observation?: string },
  ) {
    const phase =
      (body.phase as WorkOrderEvidencePhase) || WorkOrderEvidencePhase.DURING;
    const observation = body.observation || undefined;

    return this.imagesService.uploadForWorkOrder(id, files, phase, observation);
  }

  @Get('work-order/:id')
  @ApiOperation({
    summary: 'Obtener evidencias (imágenes) de una orden de trabajo',
  })
  async getWorkOrderImages(@Param('id', ParseIntPipe) id: number) {
    const images = await this.imagesService.getWorkOrderImages(id);
    return {
      message: 'Imágenes de la orden obtenidas',
      data: images,
    };
  }

  @Delete('work-order/:id')
  @Roles('Administrador')
  @ApiOperation({
    summary: 'Eliminar todas las evidencias de una orden de trabajo',
  })
  async deleteWorkOrderImages(@Param('id', ParseIntPipe) id: number) {
    await this.imagesService.deleteByWorkOrder(id);
    return {
      message: 'Imágenes de la orden eliminadas correctamente',
    };
  }
}
