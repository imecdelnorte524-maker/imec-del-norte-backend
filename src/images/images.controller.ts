import {
  Controller,
  Post,
  Delete,
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

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una imagen (Cloudinary + BD)' })
  @ApiResponse({ status: 200, description: 'Imagen eliminada correctamente' })
  @ApiResponse({ status: 404, description: 'Imagen no encontrada' })
  deleteImage(@Param('id', ParseIntPipe) id: number) {
    return this.imagesService.deleteImage(id);
  }
}
