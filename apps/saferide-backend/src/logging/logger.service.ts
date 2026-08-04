import { Injectable, LoggerService } from '@nestjs/common'
import pino from 'pino'

const pinoOptions = {
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
}

@Injectable()
export class Logger implements LoggerService {
  private logger = pino(pinoOptions as any)

  log(message: string, ...meta: any[]) {
    this.logger.info({ meta }, message)
  }
  error(message: string, trace?: string, ...meta: any[]) {
    this.logger.error({ trace, meta }, message)
  }
  warn(message: string, ...meta: any[]) {
    this.logger.warn({ meta }, message)
  }
  debug(message: string, ...meta: any[]) {
    this.logger.debug({ meta }, message)
  }
}
