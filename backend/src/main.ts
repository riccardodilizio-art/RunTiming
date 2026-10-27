import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    // Classifiche e liste Race Result possono superare il limite di default (100 KB)
    app.useBodyParser('json', { limit: '25mb' });
    app.setGlobalPrefix('api');
    app.enableCors({
        origin: process.env.CORS_ORIGIN?.split(',') ?? true,
        credentials: true,
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    const port = process.env.PORT ? Number(process.env.PORT) : 3000;
    await app.listen(port);
    // eslint-disable-next-line no-console
    console.log(`RunTiming API in ascolto su :${port}`);
}
bootstrap();
