import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';

interface DBOptions {
  url?: string;
  dbName?: string;
  retries?: number;
  delay?: number;
}

export const connectDB = async (options: DBOptions = {}): Promise<void> => {
  const {
    url = process.env['MONGO_URL'],
    dbName = process.env['DB_NAME'],
    retries = 5,
    delay = 5000,
  } = options;

  if (!url) throw AppError.badRequest('MONGO_URL is required');

  const connect = async (attempt = 1): Promise<void> => {
    try {
      const conn = await mongoose.connect(url, {
        ...(dbName ? { dbName } : {}),
        maxPoolSize: 10,
        connectTimeoutMS: 10000,
        serverSelectionTimeoutMS: 5000,
      });

      console.log(`MongoDB Connected: ${conn.connection.host}`);

      // إغلاق نظيف عند الإنهاء
      process.on('SIGINT', async () => {
        await mongoose.connection.close();
        console.log('MongoDB disconnected on app termination');
        process.exit(0);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown DB error';
      console.error(`Connection attempt ${attempt} failed: ${message}`);

      if (attempt <= retries) {
        const backoff = delay * 2 ** (attempt - 1);
        console.log(`Retrying in ${backoff / 1000}s... (${attempt}/${retries})`);
        await new Promise((res) => setTimeout(res, backoff));
        return connect(attempt + 1);
      }

      throw AppError.notFound('Failed to connect to MongoDB after retries');
    }
  };

  await connect();
};