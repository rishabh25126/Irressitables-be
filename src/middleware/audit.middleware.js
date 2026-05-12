const AuditLog = require('../models/AuditLog');
const logger = require('../config/logger');

/**
 * Reusable middleware to log an action.
 * Must be used after auth middleware (needs req.user).
 *
 * Usage: router.delete('/:id', protect, logAction('DOCUMENT_DELETE', 'Document'), handler)
 */
const logAction = (action, resource) => {
  return async (req, res, next) => {
    // We don't want to block the request if logging fails, so we fire and forget
    try {
      await AuditLog.create({
        userId: req.user._id,
        action,
        resource,
        resourceId: req.params.id || null, // Best effort to capture ID from route params
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    } catch (err) {
      logger.error({ err, action, resource, reqId: req.id }, 'Failed to write audit log');
    }
    next();
  };
};

module.exports = { logAction };
