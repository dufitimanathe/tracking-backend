import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @MinLength(8)
  @MaxLength(512)
  token!: string;

  @IsString()
  @IsIn(['ios', 'android', 'web'])
  platform!: string;
}

export class UnregisterPushTokenDto {
  @IsString()
  @MinLength(8)
  @MaxLength(512)
  token!: string;
}
