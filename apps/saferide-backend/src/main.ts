import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { Logger } from './logging/logger.service'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false })
  const logger = new Logger()
  app.useLogger(logger)

  app.setGlobalPrefix('api')
  app.enableCors({ origin: process.env.FRONTEND_ORIGIN || '*' })

  // Security middleware
  app.use(helmet())
  app.use(
    rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 100, // limit each IP to 100 requests per windowMs
    }),
  )

  const port = parseInt(process.env.PORT || '3000')
  await app.listen(port)
  logger.log(`Saferide backend listening on port ${port}`)
}
bootstrap()
