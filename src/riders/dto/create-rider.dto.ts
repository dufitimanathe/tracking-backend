import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsRwandaPhone } from '../../common/validators/is-rwanda-phone.decorator';

export class CreateRiderDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ example: 'Rider' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({ example: '+250788999888' })
  @IsString()
  @MaxLength(30)
  @IsRwandaPhone()
  phone!: string;

  @ApiProperty({ example: 'rider@company.rw' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiPropertyOptional({
    description: 'Link an existing platform user instead of creating one.',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ example: 'DL-12345' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  licenseNumber?: string;

  @ApiPropertyOptional({
    description:
      'Optional. Riders normally set their own password via the mobile activation email.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;
}
