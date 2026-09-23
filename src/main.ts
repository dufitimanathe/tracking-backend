import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const apiPrefix = config.get<string>('app.apiPrefix', { infer: true }) ?? 'api/v1';
  const port = config.get<number>('app.port', { infer: true }) ?? 3000;
  const corsOrigins = config.get<string[]>('app.corsOrigins', { infer: true }) ?? [];
  const swaggerEnabled = config.get<boolean>('app.swaggerEnabled', { infer: true }) ?? true;

  app.setGlobalPrefix(apiPrefix, { exclude: ['health', 'health/(.*)'] });
  app.use(helmet());
  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-company-id',
      'x-request-id',
      'ngrok-skip-browser-warning',
    ],
  });
  app.use(new RequestIdMiddleware().use.bind(new RequestIdMiddleware()));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Fleet Transport Platform API')
      .setDescription(
        'Multi-tenant corporate transport, fleet, dispatch, GPS, billing & incident APIs',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'x-company-id', in: 'header' }, 'company-id')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(port);
  logger.log(`API listening on :${port}/${apiPrefix}`);
  if (swaggerEnabled) {
    logger.log(`Swagger at http://localhost:${port}/api/docs`);
  }
}

bootstrap();
