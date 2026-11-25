import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { config } from './common/config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['log', 'warn', 'error'] });
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  // Ochrana proti CSRF: zápisové požadavky musí přijít z našeho webu
  const allowed = new Set([config.webOrigin, config.publicApiUrl]);
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.headers.origin;
    if (origin && !allowed.has(origin)) return res.status(403).json({ message: 'Nepovolený původ požadavku.' });
    next();
  });
  app.enableCors({ origin: config.webOrigin, credentials: true });
  app.useStaticAssets('uploads', { prefix: '/uploads', maxAge: '365d', immutable: true });
  app.enableShutdownHooks();
  await app.listen(config.port, '0.0.0.0');
  new Logger('API').log(`API běží na http://localhost:${config.port}`);
}
bootstrap();
