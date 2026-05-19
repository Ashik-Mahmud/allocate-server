import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { RequestLogger } from './middleware/request-logger.middleware';
import { cleanupOpenApiDoc, ZodValidationPipe } from 'nestjs-zod';
import * as express from 'express';
import { env } from './shared/config/env';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  // Security
  (app as any).set('trust proxy', 1);
  app.use(helmet());
  app.enableCors({
    origin: env.WEB_APP_LINK,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });
  // Middleware
  app.use(new RequestLogger().use);

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false,
      forbidNonWhitelisted: true, // previous - true
      transform: true,
    }),
  );

  // Global filters
  app.useGlobalPipes(new ZodValidationPipe());
  // app.useGlobalFilters(new ErrorHandler());

  // FOR SSL
  app.use(express.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    if (req.originalUrl === '/payments/webhook') {
      next();
    } else {
      express.json()(req, res, next);
    }
  });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Allocate ')
    .setDescription(
      'API for managing a Smart Resource-Sharing Hub for Co-working Spaces or Shared Offices API',
    )
    .setVersion('1.0')
    .addTag('Auth')
    .addBearerAuth()
    .build();
  const rawDocument = SwaggerModule.createDocument(app, config);
  const document = cleanupOpenApiDoc(rawDocument);

  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger docs available at: http://localhost:${port}/api`);
}
bootstrap();
