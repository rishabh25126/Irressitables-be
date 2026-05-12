const logger = require('../config/logger');
const env = require('../config/env');

const exposeErrorDetails =
  env.nodeEnv === 'development' || process.env.EXPOSE_ERROR_MESSAGE === 'true';

/**
 * Central error handler — catches all errors passed via next(err).
 * Must be registered as the LAST middleware in app.js.
 *
 * Returns a consistent error shape in all cases.
 */
const errorHandler = (err, req, res, next) => {
  const payload = {
    err,
    reqId: req.id,
    method: req.method,
    path: req.originalUrl || req.url,
  };
  if (env.nodeEnv === 'development') {
    payload.stack = err.stack;
  }
  logger.error(payload, err.message);

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
  const message =
    err.statusCode || exposeErrorDetails
      ? err.message || 'Internal server error'
      : 'Internal server error';

  const body = { success: false, error: message };
  if (exposeErrorDetails && err.stack) {
    body.stack = err.stack;
  }

  return res.status(statusCode).json(body);
};

module.exports = errorHandler;
