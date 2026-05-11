const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { signAccessToken, signRefreshToken, verifyToken } = require('../utils/jwt');
const { success, error } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');

// Cookie config for refresh token
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,       // Not accessible via JS — XSS protection
  secure: env.nodeEnv === 'production', // HTTPS only in production
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Select passwordHash explicitly (it's excluded by default via `select: false`)
  const user = await User.findOne({ email }).select('+passwordHash');

  if (!user || !(await user.comparePassword(password))) {
    // Generic message — don't reveal whether email exists
    return error(res, 'Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    return error(res, 'Your account has been deactivated. Contact admin.', 403, 'ACCOUNT_INACTIVE');
  }

  const accessToken = signAccessToken({ id: user._id, role: user.role });
  const refreshToken = signRefreshToken({ id: user._id });

  // Store hashed refresh token in DB (so we can invalidate on logout)
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  // Refresh token in httpOnly cookie; access token in response body
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

  // Log the login event
  await AuditLog.create({
    userId: user._id,
    action: 'LOGIN',
    resource: 'User',
    resourceId: user._id,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  return success(
    res,
    {
      accessToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    },
    'Login successful'
  );
});

/**
 * POST /api/auth/refresh
 * Reads refresh token from httpOnly cookie, issues a new access token.
 */
const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;

  if (!token) return error(res, 'No refresh token.', 401, 'NO_REFRESH_TOKEN');

  const decoded = verifyToken(token, 'refresh');
  const user = await User.findById(decoded.id).select('+refreshToken');

  if (!user || user.refreshToken !== token) {
    return error(res, 'Invalid refresh token.', 401, 'INVALID_REFRESH_TOKEN');
  }

  const newAccessToken = signAccessToken({ id: user._id, role: user.role });
  return success(res, { accessToken: newAccessToken }, 'Token refreshed');
});

/**
 * POST /api/auth/logout
 * Clears the refresh token from DB and cookie.
 */
const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;

  if (token) {
    // Invalidate the token in DB
    await User.findOneAndUpdate({ refreshToken: token }, { refreshToken: null });
  }

  res.clearCookie('refreshToken', REFRESH_COOKIE_OPTIONS);
  return success(res, null, 'Logged out successfully');
});

/**
 * POST /api/auth/change-password
 * Protected — requires valid access token.
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+passwordHash');

  if (!(await user.comparePassword(currentPassword))) {
    return error(res, 'Current password is incorrect.', 400, 'WRONG_PASSWORD');
  }

  user.passwordHash = newPassword; // pre-save hook will hash it
  user.refreshToken = null;        // invalidate all existing sessions
  await user.save();

  res.clearCookie('refreshToken', REFRESH_COOKIE_OPTIONS);
  return success(res, null, 'Password changed. Please log in again.');
});

module.exports = { login, refreshToken, logout, changePassword };
