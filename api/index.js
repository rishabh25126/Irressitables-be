/**
 * Vercel serverless entry: connects Mongo (cached, reconnects if idle-closed) then dispatches to Express.
 * Set Vercel project Root Directory to `server` when deploying from the monorepo.
 */
require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const app = require('../src/app');
const logger = require('../src/config/logger');

/** Single in-flight connect; always verify readyState before skipping work. */
let dbConnectPromise = null;

async function ensureDbConnected() {
  if (mongoose.connection.readyState === 1) {
    return;
  }
  if (!dbConnectPromise) {
    dbConnectPromise = connectDB().finally(() => {
      dbConnectPromise = null;
    });
  }
  await dbConnectPromise;

  if (mongoose.connection.readyState !== 1) {
    const msg = `MongoDB not ready (readyState=${mongoose.connection.readyState})`;
    logger.error(msg);
    throw new Error(msg);
  }
}

module.exports = async (req, res) => {
  try {
    await ensureDbConnected();
  } catch (err) {
    logger.error({ err }, '[vercel] MongoDB connection failed');
    if (!res.headersSent) {
      res.status(503).json({ success: false, error: 'Database unavailable' });
    }
    return;
  }
  app(req, res);
};
