import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [UsersModule, MailModule],
  providers: [TasksService],
})
export class TasksModule {}