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
  BadRequestException,
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
import { CloudinaryService } from './cloudinary.service';
import { UploadHeaderResponseDto } from './dto/upload-header-response.dto';
import { ConfigService } from '@nestjs/config';
import { Roles } from '../common/decorators/roles.decorator';
import { WorkOrderEvidencePhase } from '../shared';

@ApiTags('Images')
@Controller('images')
export class ImagesController {
  constructor(
    private readonly imagesService: ImagesService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly configService: ConfigService,
  ) {}

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
          items: { type: 'string', format: 'binary' },
        },
        phase: {
          type: 'string',
          enum: ['BEFORE', 'DURING', 'AFTER'],
        },
        equipmentId: {
          type: 'number',
          description:
            'ID del equipo (obligatorio en AC multi-equipo para que cuente en el cierre)',
        },
        observation: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files', 10))
  uploadWorkOrderImages(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
    @Body()
    body: {
      phase?: WorkOrderEvidencePhase;
      observation?: string;
      equipmentId?: number;
    },
  ) {
    const phase =
      (body.phase as WorkOrderEvidencePhase) || WorkOrderEvidencePhase.DURING;
    const observation = body.observation || undefined;

    return this.imagesService.uploadForWorkOrder(
      id,
      files,
      phase,
      observation,
      body.equipmentId ? Number(body.equipmentId) : undefined,
    );
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
   
  @ApiOperation({
    summary: 'Eliminar todas las evidencias de una orden de trabajo',
  })
  async deleteWorkOrderImages(@Param('id', ParseIntPipe) id: number) {
    await this.imagesService.deleteByWorkOrder(id);
    return {
      message: 'Imágenes de la orden eliminadas correctamente',
    };
  }

  @Post('upload-header')
  @ApiOperation({
    summary: 'Subir imagen de cabecera para PDFs',
    description:
      'Retorna la URL exacta donde se guardó la imagen en Cloudinary según el ambiente',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Imagen (PNG, JPG, etc.)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Imagen subida exitosamente',
    type: UploadHeaderResponseDto,
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadHeader(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadHeaderResponseDto> {
    if (!file) {
      throw new BadRequestException('No se ha subido ningún archivo');
    }

    // Validar que sea una imagen
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('El archivo debe ser una imagen');
    }

    // Validar tamaño máximo (2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('La imagen no puede ser mayor a 2MB');
    }

    // Determinar ambiente
    const environment = this.configService.get<string>(
      'NODE_ENV',
      'development',
    );

    // Subir a Cloudinary en carpeta específica por ambiente
    const folder =
      environment === 'production'
        ? 'pdf-templates/headers/production'
        : 'pdf-templates/headers/development';

    try {
      const uploadResult = await this.cloudinaryService.upload(
        file,
        folder,
        'image',
      );

      return {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        environment,
        originalName: file.originalname,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error al subir la imagen: ${error.message}`,
      );
    }
  }

  @Get('header-url')
  @ApiOperation({
    summary: 'Obtener la URL de la imagen de cabecera según el ambiente',
  })
  @ApiResponse({
    status: 200,
    schema: {
      properties: {
        url: { type: 'string' },
        environment: { type: 'string' },
      },
    },
  })
  async getHeaderUrl() {
    const environment = this.configService.get<string>(
      'NODE_ENV',
      'development',
    );

    const url = this.configService.get<string>(
      'PDF_HEADER_IMAGE_URL',
      `https://res.cloudinary.com/${this.configService.get('CLOUDINARY_CLOUD_NAME')}/image/upload/v1/pdf-templates/headers/${environment}/header_imec.png`,
    );

    return {
      url,
      environment,
    };
  }
}
