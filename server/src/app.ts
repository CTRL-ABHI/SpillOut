import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { config } from './config.js';
import { ensureDatabase, prisma } from './db.js';
import { authRouter } from './routes/auth.js';
import { accountRouter } from './routes/account.js';
import { messageRouter } from './routes/message.js';
import { conversationRouter } from './routes/conversation.js';
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

  // 2. CORS configuration with support for bound client service origin and Vercel domains
  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        if (!requestOrigin) return callback(null, true);
        if (
          !config.clientOrigin ||
          requestOrigin === config.clientOrigin ||
          requestOrigin.endsWith('.vercel.app') ||
          requestOrigin.includes('localhost')
        ) {
          return callback(null, true);
        }
        return callback(null, true);
      },
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

  // 5. Ensure database readiness on initial request
  app.use(async (_req: Request, _res: Response, next: NextFunction) => {
    try {
      await ensureDatabase();
    } catch (e: any) {
      logger.warn('Database initialization check warning:', e?.message || e);
    }
    next();
  });

  // 6. Safe Health Check endpoint with non-destructive DB ping
  app.get(['/health', '/api/health'], async (_req: Request, res: Response) => {
    let dbConnected = false;
    let dbDetail = 'connected';
    try {
      await prisma.$queryRawUnsafe('SELECT 1');
      dbConnected = true;
    } catch (e: any) {
      dbConnected = false;
      dbDetail = config.isProduction ? 'Database unreachable' : (e?.message || 'Database error');
      logger.warn('[Health Check] DB ping failed:', e?.message || e);
    }

    res.status(dbConnected ? 200 : 503).json({
      status: dbConnected ? 'healthy' : 'degraded',
      service: 'SPILLOUT-API',
      database: dbConnected ? 'connected' : 'disconnected',
      diagnostics: dbConnected ? undefined : dbDetail,
      timestamp: new Date().toISOString(),
    });
  });

  // 7. API routes (mounted with and without /api prefix to handle all Vercel rewrite patterns)
  app.use('/api/auth', authRouter);
  app.use('/auth', authRouter);
  app.use('/api/account', accountRouter);
  app.use('/account', accountRouter);
  app.use('/api/messages', messageRouter);
  app.use('/messages', messageRouter);
  app.use('/api/conversations', conversationRouter);
  app.use('/conversations', conversationRouter);

  // 8. 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  // 9. Global Error Handler - never leak stack traces or internal secrets
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled server error', err);
    res.status(500).json({
      error: 'An unexpected internal error occurred. Please try again.',
    });
  });

  return app;
}

// Instantiate default app for Vercel Express entrypoint execution
const app = createApp();
(app as any).default = app;
export default app;


