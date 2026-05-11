const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { success, error } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const crypto = require('crypto');

/**
 * GET /api/admin/users
 * Admin only. Lists all investors (paginated).
 */
const listInvestors = asyncHandler(async (req, res) => {
  const { limit = 20, page = 1 } = req.query;
  
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const investors = await User.find({ role: 'investor' })
    .select('-passwordHash -refreshToken')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await User.countDocuments({ role: 'investor' });

  return success(res, { 
    investors, 
    pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } 
  });
});

/**
 * POST /api/admin/users
 * Admin only. Creates a new investor account.
 */
const createInvestor = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return error(res, 'Email already registered.', 409, 'DUPLICATE_EMAIL');

  // If no password provided, generate a random one (for manual distribution)
  const plainPassword = password || crypto.randomBytes(8).toString('hex');

  const investor = await User.create({
    name,
    email,
    passwordHash: plainPassword,
    role: 'investor',
  });

  // In a real app, send an email to the investor here with their password

  return success(res, { 
    investor: { id: investor._id, name: investor.name, email: investor.email },
    temporaryPassword: plainPassword // ONLY return this once upon creation
  }, 'Investor created.', 201);
});

/**
 * PATCH /api/admin/users/:id/deactivate
 * Admin only. Toggles investor active status.
 */
const toggleUserStatus = asyncHandler(async (req, res) => {
  const targetUser = await User.findById(req.params.id);
  if (!targetUser) return error(res, 'User not found.', 404);
  if (targetUser.role === 'admin') return error(res, 'Cannot deactivate admins here.', 403);

  targetUser.isActive = !targetUser.isActive;
  // If deactivating, invalidate their sessions
  if (!targetUser.isActive) {
    targetUser.refreshToken = null;
  }
  await targetUser.save();

  return success(res, { isActive: targetUser.isActive }, 'User status updated.');
});

/**
 * GET /api/admin/audit-logs
 * Admin only. Fetch platform audit logs.
 */
const getAuditLogs = asyncHandler(async (req, res) => {
  const { limit = 50, cursor } = req.query;
  const pageLimit = Math.min(parseInt(limit), 100);

  const filter = {};
  if (cursor) filter._id = { $lt: cursor };

  const logs = await AuditLog.find(filter)
    .populate('userId', 'name email role')
    .sort({ _id: -1 })
    .limit(pageLimit + 1);

  const hasMore = logs.length > pageLimit;
  const results = hasMore ? logs.slice(0, pageLimit) : logs;
  const nextCursor = hasMore ? results[results.length - 1]._id : null;

  return success(res, { logs: results, nextCursor, hasMore });
});

module.exports = { listInvestors, createInvestor, toggleUserStatus, getAuditLogs };
