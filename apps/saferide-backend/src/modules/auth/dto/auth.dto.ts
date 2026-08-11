import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({ example: '+2507XXXXXXXX' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone!: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '+2507XXXXXXXX' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code!: string;

  @IsOptional()
  @IsIn(['PASSENGER', 'DRIVER'])
  role?: 'PASSENGER' | 'DRIVER';

  @IsOptional()
  @IsString()
  name?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  @Length(5, 100)
  password!: string;
}

export class RegisterDto {
  @ApiProperty({ example: '+2507XXXXXXXX' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  @Length(5, 100)
  password!: string;

  @ApiProperty({ required: false, example: 'admin' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  username?: string;

  @ApiProperty({ required: false, example: 'customer@saferide.com' })
  @IsOptional()
  @IsString()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, example: 'John Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({
    required: false,
    example: 'PASSENGER',
    enum: ['PASSENGER', 'DRIVER'],
  })
  @IsOptional()
  @IsIn(['PASSENGER', 'DRIVER'])
  role?: 'PASSENGER' | 'DRIVER';
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  refreshToken!: string;
}

export class LogoutDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  refreshToken!: string;
}
