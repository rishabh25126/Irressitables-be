const EquityRequest = require('../models/EquityRequest');
const Startup = require('../models/Startup');
const AuditLog = require('../models/AuditLog');
const { success, error } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * POST /api/requests
 * Investor only. Submit a new equity request.
 */
const createRequest = asyncHandler(async (req, res) => {
  const { startupId, type, requestedAmount, requestedShares, requestedEquityPercentage, message } = req.body;

  const startup = await Startup.findById(startupId);
  if (!startup) return error(res, 'Startup not found.', 404);

  const request = await EquityRequest.create({
    investorId: req.user._id,
    startupId,
    type,
    requestedAmount,
    requestedShares,
    requestedEquityPercentage,
    message,
  });

  await AuditLog.create({
    userId: req.user._id,
    action: 'CREATE_EQUITY_REQUEST',
    resource: 'EquityRequest',
    resourceId: request._id,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  return success(res, { request }, 'Equity request submitted successfully.', 201);
});

/**
 * GET /api/admin/requests
 * Admin only. Get pending requests.
 */
const getPendingRequests = asyncHandler(async (req, res) => {
  const requests = await EquityRequest.find({ status: 'PENDING' })
    .populate('investorId', 'name email')
    .populate('startupId', 'name')
    .sort({ createdAt: -1 });

  return success(res, { requests });
});

/**
 * PATCH /api/admin/requests/:id
 * Admin only. Approve or reject request.
 */
const updateRequestStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return error(res, 'Invalid status.', 400);
  }

  const request = await EquityRequest.findByIdAndUpdate(
    req.params.id,
    { status, handledBy: req.user._id },
    { new: true }
  );

  if (!request) return error(res, 'Request not found.', 404);

  await AuditLog.create({
    userId: req.user._id,
    action: 'UPDATE_EQUITY_REQUEST',
    resource: 'EquityRequest',
    resourceId: request._id,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // If approved, admin still needs to assign the equity via /api/admin/access endpoint manually
  // Or we could auto-assign it here, but it's safer to let them do it manually.

  return success(res, { request }, `Request marked as ${status}.`);
});

module.exports = {
  createRequest,
  getPendingRequests,
  updateRequestStatus,
};
