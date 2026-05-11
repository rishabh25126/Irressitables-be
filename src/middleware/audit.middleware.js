const AuditLog = require('../models/AuditLog');

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
      console.error(`Failed to write audit log for ${action}:`, err);
    }
    next();
  };
};

module.exports = { logAction };
