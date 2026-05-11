const InvestorAccess = require('../models/InvestorAccess');
const Startup = require('../models/Startup');
const AuditLog = require('../models/AuditLog');
const { success, error } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/investor/startups
 * Investor only. Returns all startups the logged-in investor has access to.
 */
const getMyStartups = asyncHandler(async (req, res) => {
  const accessRecords = await InvestorAccess.find({ investorId: req.user._id })
    .populate({
      path: 'startupId',
      select: 'name slug tagline sector stage logo metrics fundingAsk',
    })
    .sort({ createdAt: -1 });

  const startups = accessRecords.map((a) => a.startupId);

  return success(res, { startups });
});

/**
 * POST /api/admin/access
 * Admin only. Grants an investor access to a specific startup.
 * Body: { investorId, startupId }
 */
const assign = asyncHandler(async (req, res) => {
  const { investorId, startupId } = req.body;

  // Confirm startup exists
  const startup = await Startup.findById(startupId);
  if (!startup) return error(res, 'Startup not found.', 404);

  // Create access record (unique index prevents duplicates)
  const access = await InvestorAccess.create({
    investorId,
    startupId,
    grantedBy: req.user._id,
  });

  await AuditLog.create({
    userId: req.user._id,
    action: 'ACCESS_GRANTED',
    resource: 'InvestorAccess',
    resourceId: access._id,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  return success(res, { access }, 'Access granted.', 201);
});

/**
 * DELETE /api/admin/access
 * Admin only. Revokes an investor's access to a startup.
 * Body: { investorId, startupId }
 */
const revoke = asyncHandler(async (req, res) => {
  const { investorId, startupId } = req.body;

  const deleted = await InvestorAccess.findOneAndDelete({ investorId, startupId });

  if (!deleted) return error(res, 'Access record not found.', 404);

  await AuditLog.create({
    userId: req.user._id,
    action: 'ACCESS_REVOKED',
    resource: 'InvestorAccess',
    resourceId: deleted._id,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  return success(res, null, 'Access revoked.');
});

/**
 * GET /api/admin/startups/:id/investors
 * Admin only. Returns all investors assigned to a specific startup.
 */
const getInvestorsForStartup = asyncHandler(async (req, res) => {
  const records = await InvestorAccess.find({ startupId: req.params.id })
    .populate('investorId', 'name email')
    .populate('grantedBy', 'name')
    .sort({ createdAt: -1 });

  return success(res, { investors: records });
});

module.exports = { getMyStartups, assign, revoke, getInvestorsForStartup };
