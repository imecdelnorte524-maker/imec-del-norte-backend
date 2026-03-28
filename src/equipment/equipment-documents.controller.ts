import {
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { EquipmentDocumentsService } from './equipment-documents.service';

@ApiTags('EquipmentDocuments')
@Controller('equipment-documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EquipmentDocumentsController {
  constructor(private readonly docsService: EquipmentDocumentsService) {}

  @Delete(':id')
   
  @ApiOperation({ summary: 'Eliminar un PDF por ID (Cloudinary + BD)' })
  @ApiResponse({ status: 200, description: 'Documento eliminado' })
  deletePdf(@Param('id', ParseIntPipe) id: number) {
    return this.docsService.deleteDocument(id);
  }
}