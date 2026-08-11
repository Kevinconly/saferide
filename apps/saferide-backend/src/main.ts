import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';
import { Logger } from './logging/logger.service';
import { ConfigService } from './config/config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const logger = new Logger();
  app.useLogger(logger);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');

  const origins = config.getCorsOrigins();
  app.enableCors({
    origin: origins,
    credentials: true,
  });

  // Security middleware
  app.use(helmet());
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 300,
      standardHeaders: true,
    }),
  );

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // API documentation (non-production)
  if (
    config.get('NODE_ENV') !== 'production' &&
    config.get('SWAGGER_ENABLED') === 'true'
  ) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('SafeRide Kigali API')
      .setDescription('SafeRide Kigali ride-hailing platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = config.getNumber('PORT');
  await app.listen(port);
  logger.log(`SafeRide backend listening on port ${port}`);

  process.on('SIGTERM', () => app.close());
  process.on('SIGINT', () => app.close());
}
bootstrap();
