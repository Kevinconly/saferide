import { ApiProperty } from '@nestjs/swagger'
import { IsString, IsUrl, IsNotEmpty } from 'class-validator'

export class RegisterSubscriptionDto {
  @ApiProperty()
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true })
  endpoint: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  p256dh: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  auth: string
}

export class RemoveSubscriptionDto {
  @ApiProperty()
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true })
  endpoint: string
}
