import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ToolService } from './tool.service';
import { ToolController } from './tool.controller';
import { Tool } from './entities/tool.entity';
import { Inventory } from '../inventory/entities/inventory.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tool, Inventory]),
    MulterModule.register({
      storage: diskStorage({
        // Debe coincidir con la ruta que usas en fotoUrl y en deleteEquipmentPhoto
        destination: './uploads/tool',
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const filename = `herramienta-${uniqueSuffix}${ext}`;
          callback(null, filename);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
      fileFilter: (req, file, callback) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const isExtValid = allowedTypes.test(
          file.originalname.toLowerCase(),
        );
        const isMimeValid = allowedTypes.test(file.mimetype);

        if (isMimeValid && isExtValid) {
          return callback(null, true);
        } else {
          callback(
            new Error('Solo se permiten imágenes (JPG, PNG, GIF, WebP)'),
            false,
          );
        }
      },
    }),
  ],
  controllers: [ToolController],
  providers: [ToolService],
  exports: [ToolService],
})
export class ToolModule {}