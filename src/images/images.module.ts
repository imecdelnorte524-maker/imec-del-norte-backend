import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Image } from './entities/image.entity';
import { ImagesService } from './images.service';
import { ImagesController } from './images.controller';
import { CloudinaryService } from './cloudinary.service';
import { Tool } from '../tools/entities/tool.entity';
import { Supply } from '../supplies/entities/supply.entity';
import { User } from 'src/users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Image, Tool, Supply, User]),
  ],
  controllers: [ImagesController],
  providers: [
    ImagesService,
    CloudinaryService,
  ],
  exports: [ImagesService],
})
export class ImagesModule {}