"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("@/config/db");
const master_seed_1 = require("./master.seed");
const demo_seed_1 = require("./demo.seed");
const logger_1 = require("@/config/logger");
async function runSeed() {
    const isDemo = process.argv.includes('--demo');
    try {
        await (0, db_1.connectDB)();
        await (0, master_seed_1.seedMasterData)();
        if (isDemo) {
            await (0, demo_seed_1.seedDemoData)();
        }
        logger_1.logger.info('Database seeding completed successfully.');
    }
    catch (error) {
        logger_1.logger.error({ err: error }, 'Error while seeding database');
        process.exit(1);
    }
    finally {
        await (0, db_1.disconnectDB)();
        process.exit(0);
    }
}
runSeed();
