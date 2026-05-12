const mongoose = require('mongoose');
const env = require('./env');
const logger = require('./logger');

function isServerlessRuntime() {
  return !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

if (isServerlessRuntime()) {
  // Fail fast if a query runs without a live connection (avoids 10s buffer timeout)
  mongoose.set('bufferCommands', false);
}

function defaultRetryCount() {
  // Remaining retries after a failed attempt (serverless: 1 → 2 tries total; VM: 5 → 6 tries)
  return isServerlessRuntime() ? 1 : 5;
}

function retryDelayMs() {
  return isServerlessRuntime() ? 1000 : 3000;
}

/**
 * Connects to MongoDB with retry logic.
 * Reuses an existing connection (important for Vercel serverless).
 * On long-running Node (server.js), exits after exhausting retries.
 */
const connectDB = async (retriesLeft = defaultRetryCount()) => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const serverSelectionTimeoutMS = isServerlessRuntime() ? 10000 : 5000;

  const options = {
    serverSelectionTimeoutMS,
    ...(isServerlessRuntime()
      ? {
          maxPoolSize: 5,
          minPoolSize: 0,
          // Some serverless hosts resolve IPv6 first; Atlas SRV + IPv4 is more reliable
          family: 4,
        }
      : {}),
  };

  try {
    const conn = await mongoose.connect(env.mongoUri, options);
    logger.info({ host: conn.connection.host }, 'MongoDB connected');
    return conn;
  } catch (error) {
    if (retriesLeft > 0) {
      logger.warn(
        { err: error, retriesLeft: retriesLeft - 1 },
        'MongoDB connection failed; retrying'
      );
      await new Promise((res) => setTimeout(res, retryDelayMs()));
      return connectDB(retriesLeft - 1);
    }
    logger.error({ err: error }, 'MongoDB connection failed after all retries.');
    if (isServerlessRuntime()) {
      throw error;
    }
    process.exit(1);
  }
};

module.exports = connectDB;
