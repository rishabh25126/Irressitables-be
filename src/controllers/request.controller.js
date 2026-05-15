const EquityRequest = require("../models/EquityRequest")
const Business = require("../models/Business")
const AuditLog = require("../models/AuditLog")
const InvestorAccess = require("../models/InvestorAccess")
const User = require("../models/User")
const { success, error } = require("../utils/apiResponse")
const asyncHandler = require("../utils/asyncHandler")
const OwnerAccess = require("../models/OwnerAccess")
const { canManageBusiness } = require("../utils/businessAccess")
const {
  buildAccessProfile,
  hasPermission,
  resolveBaseRole,
} = require("../utils/rbac")

const STATUS_ALIASES = {
  APPROVED: "ACCEPTED",
}

function normalizeStatus(value) {
  if (!value) return value
  const normalized = String(value).trim().toUpperCase()
  return STATUS_ALIASES[normalized] || normalized
}

function parseStatuses(rawStatuses) {
  if (!rawStatuses) {
    return ["PENDING", "REVIEWING"]
  }

  const values = Array.isArray(rawStatuses)
    ? rawStatuses
    : String(rawStatuses)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)

  const normalized = values.map(normalizeStatus).filter(Boolean)
  return normalized.length > 0 ? normalized : ["PENDING", "REVIEWING"]
}

/**
 * POST /api/requests
 * Investor only. Submit a new equity request.
 */
const createRequest = asyncHandler(async (req, res) => {
  const {
    businessId,
    type,
    requestedAmount,
    requestedShares,
    requestedEquityPercentage,
    message,
  } = req.body

  const business = await Business.findById(businessId)
  if (!business) return error(res, "Business not found.", 404)

  const request = await EquityRequest.create({
    investorId: req.user._id,
    businessId,
    type,
    requestedAmount,
    requestedShares,
    requestedEquityPercentage,
    message,
  })

  await AuditLog.create({
    userId: req.user._id,
    action: "CREATE_EQUITY_REQUEST",
    resource: "EquityRequest",
    resourceId: request._id,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  })

  return success(
    res,
    { request },
    "Equity request submitted successfully.",
    201
  )
})

/**
 * POST /api/requests/interest
 * Public. Submit an expression-of-interest request for a business.
 */
const createInterestRequest = asyncHandler(async (req, res) => {
  const { businessId, name, email, message } = req.body

  if (!businessId || !name || !email) {
    return error(res, "Business, name, and email are required.", 400)
  }

  const business = await Business.findById(businessId)
  if (!business) return error(res, "Business not found.", 404)

  const request = await EquityRequest.create({
    businessId,
    type: "PUBLIC_INTEREST",
    contactName: name,
    contactEmail: email,
    message,
  })

  return success(res, { request }, "Interest submitted successfully.", 201)
})

/**
 * GET /api/requests/admin
 * Admin only. Get review queue with filters and pagination.
 */
const getAdminRequests = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1)
  const pageSize = Math.min(
    Math.max(parseInt(req.query.pageSize, 10) || 10, 1),
    100
  )
  const sort = req.query.sort === "newest" ? "newest" : "oldest"
  const statuses = parseStatuses(req.query.statuses)
  const businessId = req.query.businessId ? String(req.query.businessId) : null
  const requestedStatuses = statuses.includes("ACCEPTED")
    ? [...statuses, "APPROVED"]
    : statuses

  const filters = {
    status: { $in: requestedStatuses },
  }

  if ((req.user.baseRole || req.user.role) === "owner") {
    const ownedBusinessIds = await OwnerAccess.distinct("businessId", {
      ownerId: req.user._id,
    })
    filters.businessId = { $in: ownedBusinessIds }
  }

  if (businessId) {
    filters.businessId = businessId
  }

  const [requests, total, statusCounts] = await Promise.all([
    EquityRequest.find(filters)
      .populate("investorId", "name email")
      .populate("businessId", "name slug")
      .sort({
        createdAt: sort === "oldest" ? 1 : -1,
        _id: sort === "oldest" ? 1 : -1,
      })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    EquityRequest.countDocuments(filters),
    EquityRequest.aggregate([
      {
        $group: {
          _id: {
            $cond: [{ $eq: ["$status", "APPROVED"] }, "ACCEPTED", "$status"],
          },
          count: { $sum: 1 },
        },
      },
    ]),
  ])

  const summary = {
    PENDING: 0,
    REVIEWING: 0,
    REJECTED: 0,
    ACCEPTED: 0,
  }

  for (const entry of statusCounts) {
    if (summary[entry._id] !== undefined) {
      summary[entry._id] = entry.count
    }
  }

  const normalizedRequests = requests.map((request) => {
    const requestObject = request.toObject()
    requestObject.status = normalizeStatus(requestObject.status)
    return requestObject
  })

  return success(res, {
    requests: normalizedRequests,
    filters: {
      statuses,
      sort,
      businessId,
    },
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
      hasNextPage: page * pageSize < total,
      hasPreviousPage: page > 1,
    },
    summary,
  })
})

/**
 * PATCH /api/admin/requests/:id
 * Admin only. Update request review status.
 */
const updateRequestStatus = asyncHandler(async (req, res) => {
  const status = normalizeStatus(req.body.status)

  if (!["PENDING", "REVIEWING", "REJECTED", "ACCEPTED"].includes(status)) {
    return error(res, "Invalid status.", 400)
  }

  const request = await EquityRequest.findById(req.params.id)
  if (!request) return error(res, "Request not found.", 404)

  if (!(await canManageBusiness(req.user, request.businessId))) {
    return error(
      res,
      "You do not have permission to manage this business request.",
      403
    )
  }

  if (!hasPermission(req.user, "request.review")) {
    return error(res, "You do not have permission to review requests.", 403)
  }

  request.status = status
  request.handledBy = req.user._id
  await request.save()

  await AuditLog.create({
    userId: req.user._id,
    action: "UPDATE_EQUITY_REQUEST",
    resource: "EquityRequest",
    resourceId: request._id,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  })

  // If approved, admin still needs to assign the equity via /api/admin/access endpoint manually
  // Or we could auto-assign it here, but it's safer to let them do it manually.

  return success(res, { request }, `Request marked as ${status}.`)
})

/**
 * POST /api/admin/requests/:id/convert
 * Admin/owner only. Convert a request into investor/equity changes.
 */
const convertRequest = asyncHandler(async (req, res) => {
  const request = await EquityRequest.findById(req.params.id)
  if (!request) return error(res, "Request not found.", 404)

  if (!(await canManageBusiness(req.user, request.businessId))) {
    return error(
      res,
      "You do not have permission to manage this business request.",
      403
    )
  }

  if (!hasPermission(req.user, "request.convert_to_investor")) {
    return error(res, "You do not have permission to convert requests.", 403)
  }

  const {
    mode = "existing",
    investorId: requestedInvestorId,
    name,
    email,
    password,
    investedAmount = 0,
    shares = 0,
    equityPercentage = 0,
  } = req.body

  if (Number(investedAmount) <= 0) {
    return error(
      res,
      "Investor assignment requires a positive invested amount.",
      400
    )
  }

  let investorId = requestedInvestorId || request.investorId
  const normalizedMode = String(mode || "existing").toLowerCase()

  if (normalizedMode === "create") {
    if (!hasPermission(req.user, "investor.create")) {
      return error(res, "You do not have permission to create investors.", 403)
    }

    if (!name || !email || !password) {
      return error(
        res,
        "Name, email, and temporary password are required to create an investor.",
        400
      )
    }

    const existing = await User.findOne({ email: String(email).toLowerCase() })
    if (existing) {
      return error(res, "Email already registered.", 409, "DUPLICATE_EMAIL")
    }

    const createdInvestor = await User.create({
      name,
      email,
      passwordHash: password,
      role: "investor",
    })

    investorId = createdInvestor._id

    await AuditLog.create({
      userId: req.user._id,
      action: "CREATE_INVESTOR_FROM_REQUEST",
      resource: "User",
      resourceId: createdInvestor._id,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    })
  }

  if (!investorId) {
    return error(res, "An investor is required for this conversion.", 400)
  }

  if (!hasPermission(req.user, "investor.assign_equity")) {
    return error(res, "You do not have permission to assign equity.", 403)
  }

  const investor = await User.findById(investorId)
  if (!investor) {
    return error(res, "Investor not found.", 404)
  }

  const investorBaseRole = await resolveBaseRole(investor.role)
  if (investorBaseRole !== "investor") {
    return error(res, "Selected user is not an investor.", 400)
  }

  const access = await InvestorAccess.findOneAndUpdate(
    { investorId, businessId: request.businessId },
    {
      investedAmount,
      shares,
      equityPercentage,
      grantedBy: req.user._id,
    },
    { upsert: true, returnDocument: "after" }
  )

  request.investorId = investor._id
  request.requestedAmount = investedAmount
  request.requestedShares = shares
  request.requestedEquityPercentage = equityPercentage
  request.status = "ACCEPTED"
  request.handledBy = req.user._id
  await request.save()

  await AuditLog.create({
    userId: req.user._id,
    action: "CONVERT_EQUITY_REQUEST",
    resource: "EquityRequest",
    resourceId: request._id,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  })

  const accessProfile = await buildAccessProfile(investor)

  return success(
    res,
    {
      request,
      investor: {
        id: investor._id,
        name: investor.name,
        email: investor.email,
        role: accessProfile.roleKey,
        baseRole: accessProfile.baseRole,
      },
      access,
    },
    "Request converted successfully."
  )
})

module.exports = {
  createRequest,
  createInterestRequest,
  getAdminRequests,
  updateRequestStatus,
  convertRequest,
}
