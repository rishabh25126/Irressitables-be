const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');
const { error } = require('../utils/apiResponse');

/**
 * Protects routes — verifies the access token from the Authorization header.
 * Attaches the authenticated user to req.user.
 *
 * Token should be sent as: Authorization: Bearer <token>
 */
const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'Not authenticated. Please log in.', 401, 'NO_TOKEN');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token, 'access');
    const user = await User.findById(decoded.id).select('-passwordHash -refreshToken');

    if (!user) return error(res, 'User not found.', 401, 'USER_NOT_FOUND');
    if (!user.isActive) return error(res, 'Account is deactivated.', 403, 'ACCOUNT_INACTIVE');

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'Session expired. Please refresh your token.', 401, 'TOKEN_EXPIRED');
    }
    return error(res, 'Invalid token.', 401, 'INVALID_TOKEN');
  }
};

module.exports = { protect };
