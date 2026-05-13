const InvestorAccess = require("../models/InvestorAccess")
const Business = require("../models/Business")
const AuditLog = require("../models/AuditLog")
const { success, error } = require("../utils/apiResponse")
const asyncHandler = require("../utils/asyncHandler")
const {
  canManageBusiness,
  canViewBusinessDetails,
} = require("../utils/businessAccess")

/**
 * GET /api/investor/businesses
 * Investor only. Returns all businesses the logged-in investor has access to.
 */
const getMyBusinesses = asyncHandler(async (req, res) => {
  const accessRecords = await InvestorAccess.find({ investorId: req.user._id })
    .populate({
      path: "businessId",
      select:
        "name slug tagline sector stage logo metrics fundingAsk description problem solution useOfFunds team isPublished",
    })
    .sort({ createdAt: -1 })

  const businesses = accessRecords.map((a) => ({
    business: a.businessId,
    investorId: a.investorId,
    investedAmount: a.investedAmount,
    shares: a.shares,
    equityPercentage: a.equityPercentage,
  }))

  return success(res, { businesses })
})

/**
 * POST /api/admin/access
 * Admin only. Grants an investor access to a specific business.
 * Body: { investorId, businessId, investedAmount, shares, equityPercentage }
 */
const assign = asyncHandler(async (req, res) => {
  const {
    investorId,
    businessId,
    investedAmount = 0,
    shares = 0,
    equityPercentage = 0,
  } = req.body

  if (!(await canManageBusiness(req.user, businessId))) {
    return error(
      res,
      "You do not have permission to manage this business.",
      403
    )
  }

  if (Number(investedAmount) <= 0) {
    return error(
      res,
      "Investor assignment requires a positive invested amount.",
      400
    )
  }

  // Confirm business exists
  const business = await Business.findById(businessId)
  if (!business) return error(res, "Business not found.", 404)

  // Use findOneAndUpdate with upsert to allow updating existing equity or creating new access
  const access = await InvestorAccess.findOneAndUpdate(
    { investorId, businessId },
    {
      investedAmount,
      shares,
      equityPercentage,
      grantedBy: req.user._id,
    },
    { new: true, upsert: true }
  )

  await AuditLog.create({
    userId: req.user._id,
    action: "ACCESS_GRANTED",
    resource: "InvestorAccess",
    resourceId: access._id,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  })

  return success(res, { access }, "Access granted.", 201)
})

/**
 * DELETE /api/admin/access
 * Admin only. Revokes an investor's access to a business.
 * Body: { investorId, businessId }
 */
const revoke = asyncHandler(async (req, res) => {
  const { investorId, businessId } = req.body

  if (!(await canManageBusiness(req.user, businessId))) {
    return error(
      res,
      "You do not have permission to manage this business.",
      403
    )
  }

  const deleted = await InvestorAccess.findOneAndDelete({
    investorId,
    businessId,
  })

  if (!deleted) return error(res, "Access record not found.", 404)

  await AuditLog.create({
    userId: req.user._id,
    action: "ACCESS_REVOKED",
    resource: "InvestorAccess",
    resourceId: deleted._id,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  })

  return success(res, null, "Access revoked.")
})

/**
 * GET /api/admin/businesses/:id/investors
 * Admin only. Returns all investors assigned to a specific business.
 */
const getInvestorsForBusiness = asyncHandler(async (req, res) => {
  if (!(await canViewBusinessDetails(req.user, req.params.id))) {
    return error(res, "You do not have access to this business.", 403)
  }

  const records = await InvestorAccess.find({ businessId: req.params.id })
    .populate("investorId", "name email")
    .populate("grantedBy", "name")
    .sort({ createdAt: -1 })

  return success(res, { investors: records })
})

module.exports = { getMyBusinesses, assign, revoke, getInvestorsForBusiness }
