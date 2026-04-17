import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ErrorHandler } from './middleware/error-handler.middleware';
import { RequestLogger } from './middleware/request-logger.middleware';
import { cleanupOpenApiDoc, ZodValidationPipe } from 'nestjs-zod';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet());
  app.enableCors();

  // Middleware
  app.use(new RequestLogger().use);

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
       whitelist: false,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global filters
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new ErrorHandler());
  

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Allocate ')
    .setDescription('API for managing a Smart Resource-Sharing Hub for Co-working Spaces or Shared Offices API')
    .setVersion('1.0')
    .addTag('Auth')
    .addBearerAuth()
    .build();
  const rawDocument = SwaggerModule.createDocument(app, config);
  const document = cleanupOpenApiDoc(rawDocument);

  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger docs available at: http://localhost:${port}/api`);
}
bootstrap();
