import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findAll(
    @CurrentUser('userId') userId: number,
    @Query('unread') unread?: string,
  ) {
    const onlyUnread = unread === 'true';
    return this.notificationsService.findForUser(userId, onlyUnread);
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentUser('userId') userId: number,
    @Param('id') id: string,
  ) {
    await this.notificationsService.markAsRead(userId, Number(id));
    return { success: true };
  }

  @Patch('read-all')
  async markAllAsRead(@CurrentUser('userId') userId: number) {
    await this.notificationsService.markAllAsRead(userId);
    return { success: true };
  }
}