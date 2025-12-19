import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UploadedFile,
  UseInterceptors,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiConsumes,
  ApiBody,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { ImagesService } from './images.service';
import { UploadImageSwaggerDto } from './dto/upload-image.dto';

@ApiTags('Images')
@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  // ---------- HERRAMIENTAS ----------
  @Post('tool/:id')
  @ApiOperation({ summary: 'Subir o reemplazar imagen de una herramienta' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadImageSwaggerDto })
  @ApiResponse({ status: 201, description: 'Imagen subida correctamente' })
  @ApiResponse({ status: 404, description: 'Herramienta no encontrada' })
  @UseInterceptors(FileInterceptor('file'))
  uploadToolImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.imagesService.uploadForTool(id, file);
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
  @ApiOperation({ summary: 'Subir o reemplazar imagen de un insumo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadImageSwaggerDto })
  @ApiResponse({ status: 201, description: 'Imagen subida correctamente' })
  @ApiResponse({ status: 404, description: 'Insumo no encontrado' })
  @UseInterceptors(FileInterceptor('file'))
  uploadSupplyImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.imagesService.uploadForSupply(id, file);
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
}