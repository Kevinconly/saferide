import { ApiProperty } from '@nestjs/swagger'
import { IsIn, IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator'

export class RequestOtpDto {
  @ApiProperty({ example: '+2507XXXXXXXX' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone: string
}

export class VerifyOtpDto {
  @ApiProperty({ example: '+2507XXXXXXXX' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone: string

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string

  @IsOptional()
  @IsIn(['PASSENGER', 'DRIVER'])
  role?: 'PASSENGER' | 'DRIVER'

  @IsOptional()
  @IsString()
  name?: string
}

export class LoginDto {
  @ApiProperty({ example: '+2507XXXXXXXX' })
  @IsString()
  @IsNotEmpty()
  phone: string

  @IsOptional()
  @IsString()
  password?: string
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken: string
}

export class LogoutDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken: string
}
