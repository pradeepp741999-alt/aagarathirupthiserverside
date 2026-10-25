import { connectDB, disconnectDB } from '@/config/db';
import { seedMasterData } from './master.seed';
import { seedDemoData } from './demo.seed';
import { logger } from '@/config/logger';

async function runSeed() {
  const isDemo = process.argv.includes('--demo');

  try {
    await connectDB();
    await seedMasterData();

    if (isDemo) {
      await seedDemoData();
    }

    logger.info('Database seeding completed successfully.');
  } catch (error) {
    logger.error({ err: error }, 'Error while seeding database');
    process.exit(1);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
}

runSeed();
