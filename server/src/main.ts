import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.enableCors({
    origin: process.env.CLIENT_BASE_URL,
    methods: 'GET, POST, PUT, PATCH, DELETE, HEAD',
    credentials: true,
  });

  const PORT = process.env.PORT || 3001;
  await app.listen(PORT);

  console.log(`Server is running on: ${await app.getUrl()}`);
}
bootstrap();
