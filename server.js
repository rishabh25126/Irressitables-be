require('dotenv').config();
const logger = require('./src/config/logger');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const env = require('./src/config/env');

// Handle uncaught exceptions gracefully
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'UNCAUGHT EXCEPTION! Shutting down...');
  process.exit(1);
});

let server;

// Connect to Database, then start server
connectDB().then(() => {
  server = app.listen(env.port, () => {
    logger.info({ port: env.port, nodeEnv: env.nodeEnv }, 'Server listening');
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.fatal({ err }, 'UNHANDLED REJECTION! Shutting down...');
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// Handle SIGTERM (e.g. from Heroku or Docker)
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  if (server) {
    server.close(() => {
      logger.info('Process terminated.');
    });
  }
});
