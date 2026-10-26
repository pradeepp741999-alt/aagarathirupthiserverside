"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
exports.disconnectDB = disconnectDB;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("./env");
const logger_1 = require("./logger");
async function connectDB(uri = env_1.env.MONGODB_URI) {
    try {
        mongoose_1.default.set('strictQuery', true);
        const conn = await mongoose_1.default.connect(uri, {
            autoIndex: env_1.env.SYNC_INDEXES,
            tlsAllowInvalidCertificates: true,
        });
        logger_1.logger.info({ uri: uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@') }, 'Connected to MongoDB');
        return conn;
    }
    catch (error) {
        logger_1.logger.error({ err: error }, 'Failed to connect to MongoDB');
        throw error;
    }
}
async function disconnectDB() {
    await mongoose_1.default.disconnect();
    logger_1.logger.info('Disconnected from MongoDB');
}
