import { Body, Controller, Delete, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiSuccessResponse } from '../common/decorators/api-success.decorator';
import { successResponse } from '../common/dto/api-response.dto';
import { DevicePushTokensService } from './device-push-tokens.service';
import { RegisterPushTokenDto, UnregisterPushTokenDto } from './dto/push-token.dto';

@ApiTags('devices')
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicePushTokensService: DevicePushTokensService) {}

  @Post('push-token')
  @ApiSuccessResponse(Object)
  async register(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegisterPushTokenDto,
  ) {
    const saved = await this.devicePushTokensService.upsertToken(
      user.id,
      dto.token.trim(),
      dto.platform,
    );
    return successResponse({ id: saved.id, platform: saved.platform });
  }

  @Delete('push-token')
  @ApiSuccessResponse(Object)
  async unregister(
    @CurrentUser() user: AuthUser,
    @Body() dto: UnregisterPushTokenDto,
  ) {
    await this.devicePushTokensService.removeToken(user.id, dto.token.trim());
    return successResponse({ removed: true });
  }
}
