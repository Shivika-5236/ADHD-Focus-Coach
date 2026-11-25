import mongoose from 'mongoose';

let lastDatabaseError: string | null = null;

export const isDatabaseConnected = (): boolean => mongoose.connection.readyState === 1;

export const getDatabaseError = (): string | null => lastDatabaseError;

const connectDB = async (): Promise<void> => {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    lastDatabaseError = 'DATABASE_URL is not set in backend/.env';
    console.error('⚠️ DATABASE_URL is not set in backend/.env. MongoDB Atlas persistence is disabled.');
    return;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
    });
    lastDatabaseError = null;
    console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host}`);
  } catch (error) {
    lastDatabaseError = error instanceof Error ? error.message : String(error);
    console.error('⚠️ MongoDB Atlas connection error (check DATABASE_URL in backend/.env and Atlas Network Access):', error);
  }
};

export default connectDB;
