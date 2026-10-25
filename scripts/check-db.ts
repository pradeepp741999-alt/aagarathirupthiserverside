import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI;

async function checkConnection() {
  console.log('Testing connection to MongoDB...');
  console.log('URI:', uri ? uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@') : 'NOT_FOUND');

  if (!uri) {
    console.error('Error: MONGODB_URI is not set in environment or .env');
    process.exit(1);
  }

  try {
    const startTime = Date.now();
    await mongoose.connect(uri, {
      tlsAllowInvalidCertificates: true,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    const duration = Date.now() - startTime;

    console.log(`✅ MongoDB Connected Successfully in ${duration}ms!`);
    console.log('Connection State:', mongoose.connection.readyState === 1 ? 'Connected (1)' : mongoose.connection.readyState);
    console.log('Host:', mongoose.connection.host);
    console.log('Database Name:', mongoose.connection.name || '(default)');

    // Run a ping command
    const adminDb = mongoose.connection.db?.admin();
    if (adminDb) {
      const pingResult = await adminDb.ping();
      console.log('Ping Result:', pingResult);
    }

    // List collections
    const collections = await mongoose.connection.db?.listCollections().toArray();
    console.log('Existing Collections:', collections?.map(c => c.name) || []);

    await mongoose.disconnect();
    console.log('Connection closed cleanly.');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ MongoDB Connection Failed!');
    console.error('Error Name:', err.name);
    console.error('Error Message:', err.message);
    if (err.reason) {
      console.error('Reason:', err.reason);
    }
    process.exit(1);
  }
}

checkConnection();
