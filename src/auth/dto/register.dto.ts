import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsRwandaPhone } from '../../common/validators/is-rwanda-phone.decorator';

export class RegisterDto {
  @ApiProperty({ example: 'Jane' })
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MaxLength(100)
  lastName!: string;

  @ApiPropertyOptional({ example: 'jane@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: '+250788123456' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @IsRwandaPhone()
  phone?: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password must contain uppercase, lowercase, and a number.',
  })
  password!: string;
}
