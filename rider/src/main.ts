import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ErrorEnvelopeFilter } from './common/filters/error-envelope.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ErrorEnvelopeFilter());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
