import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { isTrustedWrite, originOf } from './auth/csrf';
import { config } from './common/config';

/** Vytvoří a nakonfiguruje aplikaci (sdílené pro běžný server i serverless funkci na Vercelu). */
export async function createApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['log', 'warn', 'error'] });
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  // Ochrana proti CSRF: zápisové požadavky musí přijít z našeho webu (Origin, případně Referer), viz auth/csrf.ts
  const allowed = new Set([config.webOrigin, config.publicApiUrl].map((u) => originOf(u)).filter((u): u is string => !!u));
  // Na Vercelu povolíme i adresu konkrétního nasazení a větve
  for (const h of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) if (h) allowed.add(`https://${h}`);
  app.use((req: Request, res: Response, next: NextFunction) => {
    const ok = isTrustedWrite({
      method: req.method, path: req.path,
      origin: typeof req.headers.origin === 'string' ? req.headers.origin : undefined,
      referer: typeof req.headers.referer === 'string' ? req.headers.referer : undefined,
      hasCookie: !!req.headers.cookie, hasBearer: !!req.headers.authorization?.startsWith('Bearer '),
    }, allowed);
    if (!ok) return res.status(403).json({ message: 'Nepovolený původ požadavku.' });
    next();
  });
  app.enableCors({ origin: config.webOrigin, credentials: true });
  app.useStaticAssets('uploads', { prefix: '/uploads', maxAge: '365d', immutable: true });
  return app;
}

async function bootstrap() {
  const app = await createApp();
  app.enableShutdownHooks();
  await app.listen(config.port, '0.0.0.0');
  new Logger('API').log(`API běží na http://localhost:${config.port}`);
}
if (require.main === module) void bootstrap();
