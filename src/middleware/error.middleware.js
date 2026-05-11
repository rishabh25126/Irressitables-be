const env = require('../config/env');

/**
 * Central error handler — catches all errors passed via next(err).
 * Must be registered as the LAST middleware in app.js.
 *
 * Returns a consistent error shape in all cases.
 */
const errorHandler = (err, req, res, next) => {
  // Log the full error in development; suppress stack in production
  if (env.nodeEnv === 'development') {
    console.error(`[ERROR] ${err.message}`, err.stack);
  } else {
    console.error(`[ERROR] ${err.message}`);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(400).json({ success: false, error: 'Validation failed', details });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      error: `${field} already exists.`,
      code: 'DUPLICATE_KEY',
    });
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, error: 'Invalid ID format.' });
  }

  // Default fallback
  const statusCode = err.statusCode || 500;
  const message = err.statusCode ? err.message : 'Internal server error';

  return res.status(statusCode).json({ success: false, error: message });
};

module.exports = errorHandler;
