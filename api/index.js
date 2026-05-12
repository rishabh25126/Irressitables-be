/**
 * Vercel serverless entry: connects Mongo (cached) then dispatches to Express.
 * Set Vercel project Root Directory to `server` when deploying from the monorepo.
 */
require('dotenv').config();

const connectDB = require('../src/config/db');
const app = require('../src/app');

let connectPromise;

function ensureDbConnected() {
  if (!connectPromise) {
    connectPromise = connectDB().catch((err) => {
      connectPromise = null;
      throw err;
    });
  }
  return connectPromise;
}

module.exports = async (req, res) => {
  try {
    await ensureDbConnected();
  } catch (err) {
    console.error('[vercel] MongoDB connection failed:', err);
    if (!res.headersSent) {
      res.status(503).json({ success: false, error: 'Database unavailable' });
    }
    return;
  }
  app(req, res);
};
