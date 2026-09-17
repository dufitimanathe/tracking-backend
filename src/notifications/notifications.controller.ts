import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ApiSuccessResponse } from '../common/decorators/api-success.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CompanyScoped } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { paginatedResponse, successResponse } from '../common/dto/api-response.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@CompanyScoped()
@UseGuards(CompanyAccessGuard, RolesGuard)
@Controller('companies/:companyId/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiSuccessResponse(NotificationResponseDto, true)
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ) {
    const { items, total } = await this.notificationsService.listForUser(
      user.id,
      companyId,
      query,
    );
    return paginatedResponse(items, query.page, query.limit, total);
  }

  @Patch(':notificationId/read')
  @ApiSuccessResponse(NotificationResponseDto)
  async markRead(
    @Param('companyId', ParseUUIDPipe) _companyId: string,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const notification = await this.notificationsService.markRead(user.id, notificationId);
    return successResponse(notification);
  }
}
