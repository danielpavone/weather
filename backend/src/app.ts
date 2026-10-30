import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { resolveCorsOrigins } from './cors';
import { resolveTrustProxy } from './trustProxy';
import { weatherRouter } from './weather/router';

const GENERIC_SERVER_ERROR = 'Erro interno do servidor.';
const RATE_LIMIT_MESSAGE = 'Muitas consultas em pouco tempo. Tente novamente em instantes.';

function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return value;
}

export function createWeatherRateLimit() {
  return rateLimit({
    windowMs: readPositiveInt(process.env.WEATHER_RATE_LIMIT_WINDOW_MS, 60_000),
    limit: readPositiveInt(process.env.WEATHER_RATE_LIMIT_MAX, 30),
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: RATE_LIMIT_MESSAGE },
    handler: (_req: Request, res: Response, _next: NextFunction) => {
      res.status(429).json({ message: RATE_LIMIT_MESSAGE });
    },
  });
}

export function createApp(): Express {
  const app = express();
  app.set('trust proxy', resolveTrustProxy());

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(cors({ origin: resolveCorsOrigins() }));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/weather', createWeatherRateLimit(), weatherRouter);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack ?? err);
    res.status(500).json({ message: GENERIC_SERVER_ERROR });
  });

  return app;
}
