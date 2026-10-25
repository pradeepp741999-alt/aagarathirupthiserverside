import http from 'http';
import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectDB, disconnectDB } from './config/db';
import { startJobs, stopJobs } from './jobs/index';

let server: http.Server;

async function bootstrap(): Promise<void> {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Start background cron jobs
    startJobs();

    // 3. Start HTTP server
    server = app.listen(env.PORT, () => {
      logger.info(
        {
          port: env.PORT,
          env: env.NODE_ENV,
          apiPrefix: '/api/v1',
        },
        `🚀 Aagara Thirupthi Backend running on port ${env.PORT}`
      );
    });

    // 4. Graceful shutdown handler
    const handleShutdown = async (signal: string) => {
      logger.info({ signal }, 'Received shutdown signal, shutting down gracefully...');

      // Stop cron jobs
      stopJobs();

      if (server) {
        server.close(async () => {
          logger.info('HTTP server closed');
          try {
            await disconnectDB();
            logger.info('Database connections closed cleanly');
            process.exit(0);
          } catch (err) {
            logger.error({ err }, 'Error during database disconnection');
            process.exit(1);
          }
        });

        // Force shutdown after 10s if connections linger
        setTimeout(() => {
          logger.error('Graceful shutdown timed out, forcing exit');
          process.exit(1);
        }, 10000).unref();
      } else {
        process.exit(0);
      }
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      logger.error({ err: reason }, 'Unhandled Rejection detected');
    });

    process.on('uncaughtException', (err) => {
      logger.fatal({ err }, 'Uncaught Exception detected, shutting down');
      handleShutdown('uncaughtException');
    });
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

void bootstrap();
