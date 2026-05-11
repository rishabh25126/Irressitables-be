const mongoose = require('mongoose');
const env = require('./env');

/**
 * Connects to MongoDB with retry logic.
 * Retries up to 5 times with a 3-second delay between attempts.
 */
const connectDB = async (retries = 5) => {
  try {
    const conn = await mongoose.connect(env.mongoUri, {
      // Mongoose 7+ handles these automatically, but explicit for clarity
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    if (retries > 0) {
      console.warn(`MongoDB connection failed. Retrying... (${retries} attempts left)`);
      await new Promise((res) => setTimeout(res, 3000));
      return connectDB(retries - 1);
    }
    console.error('MongoDB connection failed after all retries. Exiting.');
    process.exit(1);
  }
};

module.exports = connectDB;
