import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ErrorHandler } from './middleware/error-handler.middleware';
import { RequestLogger } from './middleware/request-logger.middleware';

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
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global filters
  app.useGlobalFilters(new ErrorHandler());

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Shift Payroll Calculator API')
    .setDescription('API for managing shifts and payroll calculations')
    .setVersion('1.0')
    .addTag('shifts')
    .addTag('payroll')
    .addTag('auth')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger docs available at: http://localhost:${port}/api`);
}
bootstrap();
