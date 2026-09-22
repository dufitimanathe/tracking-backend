import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeActivationCode } from '../../common/utils/activation-code.util';

export class ActivateAccountDto {
  @ApiProperty({
    description: '6-character activation code from the invite email (letters + numbers).',
    example: 'A7K3M2',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeActivationCode(value) : value,
  )
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  @Matches(/^[A-Z0-9]{6}$/, {
    message: 'Activation code must be 6 letters or numbers.',
  })
  token!: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password must contain uppercase, lowercase, and a number.',
  })
  password!: string;
}

export class ActivateAccountResponseDto {
  @ApiProperty()
  message!: string;

  @ApiPropertyOptional()
  email?: string | null;
}
