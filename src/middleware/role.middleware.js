const { error } = require('../utils/apiResponse');

/**
 * Role-based access control middleware.
 * Must be used after the `protect` middleware (req.user must be set).
 *
 * Usage: router.get('/admin', protect, requireRole('admin'), handler)
 * Usage: router.get('/data', protect, requireRole('admin', 'investor'), handler)
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, 'Not authenticated.', 401);
    }

    if (!roles.includes(req.user.role)) {
      return error(
        res,
        `Access denied. Required role: ${roles.join(' or ')}.`,
        403,
        'FORBIDDEN'
      );
    }

    next();
  };
};

module.exports = { requireRole };
