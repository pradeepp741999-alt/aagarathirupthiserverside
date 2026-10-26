"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("./config/env");
const logger_1 = require("./config/logger");
const db_1 = require("./config/db");
const index_1 = require("./jobs/index");
let server;
async function bootstrap() {
    try {
        // 1. Connect to MongoDB
        await (0, db_1.connectDB)();
        // 2. Start background cron jobs
        (0, index_1.startJobs)();
        // 3. Start HTTP server
        server = app_1.app.listen(env_1.env.PORT, () => {
            logger_1.logger.info({
                port: env_1.env.PORT,
                env: env_1.env.NODE_ENV,
                apiPrefix: '/api/v1',
            }, `🚀 Aagara Thirupthi Backend running on port ${env_1.env.PORT}`);
        });
        // 4. Graceful shutdown handler
        const handleShutdown = async (signal) => {
            logger_1.logger.info({ signal }, 'Received shutdown signal, shutting down gracefully...');
            // Stop cron jobs
            (0, index_1.stopJobs)();
            if (server) {
                server.close(async () => {
                    logger_1.logger.info('HTTP server closed');
                    try {
                        await (0, db_1.disconnectDB)();
                        logger_1.logger.info('Database connections closed cleanly');
                        process.exit(0);
                    }
                    catch (err) {
                        logger_1.logger.error({ err }, 'Error during database disconnection');
                        process.exit(1);
                    }
                });
                // Force shutdown after 10s if connections linger
                setTimeout(() => {
                    logger_1.logger.error('Graceful shutdown timed out, forcing exit');
                    process.exit(1);
                }, 10000).unref();
            }
            else {
                process.exit(0);
            }
        };
        process.on('SIGTERM', () => handleShutdown('SIGTERM'));
        process.on('SIGINT', () => handleShutdown('SIGINT'));
        process.on('unhandledRejection', (reason) => {
            logger_1.logger.error({ err: reason }, 'Unhandled Rejection detected');
        });
        process.on('uncaughtException', (err) => {
            logger_1.logger.fatal({ err }, 'Uncaught Exception detected, shutting down');
            handleShutdown('uncaughtException');
        });
    }
    catch (err) {
        logger_1.logger.fatal({ err }, 'Failed to start server');
        process.exit(1);
    }
}
void bootstrap();
