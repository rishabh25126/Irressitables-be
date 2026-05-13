const OwnerAccess = require('../models/OwnerAccess');
const Business = require('../models/Business');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { success, error } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { canManageBusiness, canViewBusinessDetails } = require('../utils/businessAccess');

const getMyBusinesses = asyncHandler(async (req, res) => {
  const ownerships = await OwnerAccess.find({ ownerId: req.user._id })
    .populate({
      path: 'businessId',
      select: 'name slug tagline sector stage logo metrics fundingAsk isPublished createdAt',
    })
    .sort({ createdAt: -1 });

  const businesses = ownerships.map((record) => ({
    ...record.businessId.toObject(),
    ownershipId: record._id,
  }));

  return success(res, { businesses });
});

const assign = asyncHandler(async (req, res) => {
  const { ownerId, businessId } = req.body;

  const [owner, business] = await Promise.all([
    User.findById(ownerId),
    Business.findById(businessId),
  ]);

  if (!owner || owner.role !== 'owner') {
    return error(res, 'Owner not found.', 404);
  }

  if (!business) {
    return error(res, 'Business not found.', 404);
  }

  const record = await OwnerAccess.findOneAndUpdate(
    { ownerId, businessId },
    { grantedBy: req.user._id },
    { new: true, upsert: true }
  );

  await AuditLog.create({
    userId: req.user._id,
    action: 'OWNER_ASSIGNED',
    resource: 'OwnerAccess',
    resourceId: record._id,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  return success(res, { ownership: record }, 'Owner assigned.', 201);
});

const revoke = asyncHandler(async (req, res) => {
  const { ownerId, businessId } = req.body;

  const existing = await OwnerAccess.findOne({ ownerId, businessId });
  if (!existing) {
    return error(res, 'Owner assignment not found.', 404);
  }

  const remainingOwners = await OwnerAccess.countDocuments({ businessId });
  if (remainingOwners <= 1) {
    return error(res, 'A business must have at least one owner.', 400);
  }

  const deleted = await OwnerAccess.findOneAndDelete({ ownerId, businessId });

  await AuditLog.create({
    userId: req.user._id,
    action: 'OWNER_REVOKED',
    resource: 'OwnerAccess',
    resourceId: deleted._id,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  return success(res, null, 'Owner assignment removed.');
});

const getOwnersForBusiness = asyncHandler(async (req, res) => {
  if (!(await canViewBusinessDetails(req.user, req.params.id))) {
    return error(res, 'You do not have access to this business.', 403);
  }

  const owners = await OwnerAccess.find({ businessId: req.params.id })
    .populate('ownerId', 'name email role')
    .populate('grantedBy', 'name')
    .sort({ createdAt: -1 });

  return success(res, { owners });
});

module.exports = {
  getMyBusinesses,
  assign,
  revoke,
  getOwnersForBusiness,
};
