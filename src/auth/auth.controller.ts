import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/roles.decorator';
import { ApiSuccessResponse } from '../common/decorators/api-success.decorator';
import { successResponse } from '../common/dto/api-response.dto';
import { RegisterCompanyDto } from '../companies/dto/register-company.dto';
import { AuthService } from './auth.service';
import { AuthResponseDto, AuthTokensDto } from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import { LoginDto } from './dto/login.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { AuthenticatedRequest } from './interfaces/authenticated-request.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiSuccessResponse(AuthResponseDto)
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return successResponse(result);
  }

  @Public()
  @Post('register-company')
  @ApiSuccessResponse(AuthResponseDto)
  async registerCompany(@Body() dto: RegisterCompanyDto) {
    const result = await this.authService.registerCompany(dto);
    return successResponse(result);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiSuccessResponse(AuthResponseDto)
  async login(@Body() dto: LoginDto, @Req() req: AuthenticatedRequest) {
    const result = await this.authService.login(
      dto,
      req.headers['user-agent'],
      req.ip,
    );
    return successResponse(result);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiSuccessResponse(AuthTokensDto)
  async refresh(@Body() dto: RefreshDto, @Req() req: AuthenticatedRequest) {
    const tokens = await this.authService.refresh(
      dto.refreshToken,
      req.headers['user-agent'],
      req.ip,
    );
    return successResponse(tokens);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: RefreshDto) {
    await this.authService.logout(dto.refreshToken);
    return successResponse({ message: 'Logged out successfully.' });
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(user.id, dto);
    return successResponse({ message: 'Password changed successfully.' });
  }

  @Get('me')
  @ApiSuccessResponse(MeResponseDto)
  async me(@CurrentUser() user: AuthUser) {
    const profile = await this.authService.me(user.id);
    return successResponse(profile);
  }

  @Public()
  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    const result = await this.authService.requestPasswordReset(dto);
    return successResponse(result);
  }

  @Public()
  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto) {
    await this.authService.confirmPasswordReset(dto);
    return successResponse({ message: 'Password reset successfully.' });
  }
}
