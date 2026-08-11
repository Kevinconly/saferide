import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

export class InitiatePaymentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  rideId: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string
}

export class RefundPaymentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string
}

export class SandboxWebhookDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  paymentId: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string
}
