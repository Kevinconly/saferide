import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string

  @IsOptional()
  @IsEmail()
  email?: string
}
