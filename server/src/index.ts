import http from 'http';
import { WebSocketServer } from 'ws';
import { createApp } from './app.js';
import { config } from './config.js';
import { setupWebSocketServer } from './services/websocket.service.js';
import { accountCleanupService } from './services/account-cleanup.service.js';
import { logger } from './utils/logger.js';
import { prisma } from './db.js';

async function main() {
  const app = createApp();
  const server = http.createServer(app);

  // Initialize WebSocket Server on path /ws
  const wss = new WebSocketServer({
    server,
    path: '/ws',
  });

  setupWebSocketServer(wss);

  // Start 7-day inactivity cleanup background service
  accountCleanupService.start();

  server.listen(config.port, () => {
    logger.info(`SPILLOUT backend running on port ${config.port}`);
    logger.info(`WebSocket endpoint available at ws://localhost:${config.port}/ws`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`Inactivity expiration policy: ${config.inactivityExpirationDays} consecutive days`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down cleanly...`);
    accountCleanupService.stop();

    wss.close(() => {
      logger.info('WebSocket server closed');
    });

    server.close(async () => {
      logger.info('HTTP server closed');
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Fatal startup error', err);
  process.exit(1);
});
