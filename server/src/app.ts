import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { accountRouter } from './routes/account.js';
import { logger } from './utils/logger.js';

export function createApp(): Express {
  const app = express();

  // 1. Security Headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'", config.clientOrigin, 'ws:', 'wss:'],
          imgSrc: ["'self'", 'data:'],
          mediaSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  // 2. CORS configuration restricted to client origin
  app.use(
    cors({
      origin: config.clientOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // 3. Body parsers with strict size limits
  app.use(express.json({ limit: '64kb' }));
  app.use(express.urlencoded({ extended: true, limit: '64kb' }));

  // 4. Cookie parser
  app.use(cookieParser(config.cookieSecret));

  // 5. Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'SPILLOUT-API',
      timestamp: new Date().toISOString(),
    });
  });

  // 6. API routes
  app.use('/api/auth', authRouter);
  app.use('/api/account', accountRouter);

  // 7. 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  // 8. Global Error Handler - never leak stack traces or internal secrets
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled server error', err);
    res.status(500).json({
      error: 'An unexpected internal error occurred. Please try again.',
    });
  });

  return app;
}
