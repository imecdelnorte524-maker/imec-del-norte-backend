import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Query,
  Delete,
  Post,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationModule, NotificationPriority } from '../shared/index';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findAll(
    @CurrentUser('userId') userId: number,
    @Query('unread') unread?: string,
    @Query('modulo') modulo?: NotificationModule,
    @Query('prioridad') prioridad?: NotificationPriority,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.notificationsService.findForUser(userId, {
      onlyUnread: unread === 'true',
      modulo,
      prioridad,
      desde: desde ? new Date(desde) : undefined,
      hasta: hasta ? new Date(hasta) : undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get('unread-counts')
  async getUnreadCounts(@CurrentUser('userId') userId: number) {
    return this.notificationsService.getUnreadCountByModule(userId);
  }

  @Get('unread-total')
  async getUnreadTotal(@CurrentUser('userId') userId: number) {
    const total = await this.notificationsService.getUnreadCount(userId);
    return { total };
  }

  @Get('summary')
  async getSummary(@CurrentUser('userId') userId: number) {
    const [recent, unreadCounts] = await Promise.all([
      this.notificationsService.findForUser(userId, { limit: 10 }),
      this.notificationsService.getUnreadCountByModule(userId),
    ]);

    return {
      recent,
      unreadCounts,
      totalUnread: Object.values(unreadCounts).reduce((a, b) => a + b, 0),
    };
  }

  @Get(':id')
  async findOne(
    @CurrentUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.notificationsService.findOne(id);
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.notificationsService.markAsRead(userId, id);
    return { success: true };
  }

  @Patch('read-all')
  async markAllAsRead(
    @CurrentUser('userId') userId: number,
    @Query('modulo') modulo?: NotificationModule,
  ) {
    await this.notificationsService.markAllAsRead(userId, modulo);
    return { success: true };
  }

  @Delete('clean')
  async cleanOldNotifications() {
    const deleted = await this.notificationsService.cleanOldNotifications();
    return { deleted };
  }
}
