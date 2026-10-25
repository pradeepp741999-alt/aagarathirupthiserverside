import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

export async function connectDB(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  try {
    mongoose.set('strictQuery', true);
    const conn = await mongoose.connect(uri, {
      autoIndex: env.SYNC_INDEXES,
      tlsAllowInvalidCertificates: true,
    });
    logger.info({ uri: uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@') }, 'Connected to MongoDB');
    return conn;
  } catch (error) {
    logger.error({ err: error }, 'Failed to connect to MongoDB');
    throw error;
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  logger.info('Disconnected from MongoDB');
}
