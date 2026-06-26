import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Global input validation: strip unknown props, reject extras, auto-transform payloads.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Allow the Next.js frontend (dev: localhost:3000) to call the API.
  app.enableCors({
    origin: config.get<string>('FRONTEND_URL'),
    credentials: true,
  });

  const port = config.get<number>('PORT', 4000);
  await app.listen(port);
  Logger.log(`LocalGig API running on http://localhost:${port}`, 'Bootstrap');
}
void bootstrap();
