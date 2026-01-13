// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { MailModule } from 'src/mail/mail.module';
import { ImagesModule } from 'src/images/images.module';
import { UserPasswordHistory } from './entities/user-password-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, UserPasswordHistory]),
    MailModule,
    ImagesModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}