const User = require("../models/User")
const AuditLog = require("../models/AuditLog")
const InvestorAccess = require("../models/InvestorAccess")
const { success, error } = require("../utils/apiResponse")
const asyncHandler = require("../utils/asyncHandler")
const { canManageBusiness } = require("../utils/businessAccess")
const crypto = require("crypto")

/**
 * GET /api/admin/users
 * Admin/Owner. Lists non-admin users with optional role filtering.
 */
const listUsers = asyncHandler(async (req, res) => {
  const { limit = 50, page = 1, role = "all" } = req.query
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10)

  const allowedRoles = role === "all" ? ["investor", "owner"] : [role]
  const filter = { role: { $in: allowedRoles } }

  if (req.user.role === "owner") {
    filter.role = "investor"
  }

  const users = await User.find(filter)
    .select("-passwordHash -refreshToken")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10))

  const total = await User.countDocuments(filter)
  const investors = users.filter((user) => user.role === "investor")
  const owners = users.filter((user) => user.role === "owner")

  return success(res, {
    users,
    investors,
    owners,
    pagination: {
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
    },
  })
})

/**
 * POST /api/admin/users
 * Admin can create owner or investor. Owners can create investor only.
 */
const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role = "investor" } = req.body

  if (!["investor", "owner"].includes(role)) {
    return error(
      res,
      "Only owner and investor accounts can be created here.",
      400
    )
  }

  if (req.user.role === "owner" && role !== "investor") {
    return error(res, "Owners can only create investor accounts.", 403)
  }

  const existing = await User.findOne({ email: email.toLowerCase() })
  if (existing)
    return error(res, "Email already registered.", 409, "DUPLICATE_EMAIL")

  const plainPassword = password || crypto.randomBytes(8).toString("hex")

  const user = await User.create({
    name,
    email,
    passwordHash: plainPassword,
    role,
  })

  await AuditLog.create({
    userId: req.user._id,
    action: role === "owner" ? "CREATE_OWNER" : "CREATE_INVESTOR",
    resource: "User",
    resourceId: user._id,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  })

  return success(
    res,
    {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      temporaryPassword: plainPassword,
    },
    `${role === "owner" ? "Owner" : "Investor"} created.`,
    201
  )
})

/**
 * PATCH /api/admin/users/:id/deactivate
 * Admin only. Toggles user active status.
 */
const toggleUserStatus = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    return error(res, "Only admins can change account status.", 403)
  }

  const targetUser = await User.findById(req.params.id)
  if (!targetUser) return error(res, "User not found.", 404)
  if (targetUser.role === "admin")
    return error(res, "Cannot deactivate admins here.", 403)

  targetUser.isActive = !targetUser.isActive
  if (!targetUser.isActive) {
    targetUser.refreshToken = null
  }
  await targetUser.save()

  return success(res, { isActive: targetUser.isActive }, "User status updated.")
})

/**
 * GET /api/admin/businesses/:id/investors
 * Admin/Owner. Returns investors for a business.
 */
const getBusinessInvestors = asyncHandler(async (req, res) => {
  if (!(await canManageBusiness(req.user, req.params.id))) {
    return error(
      res,
      "You do not have permission to manage this business.",
      403
    )
  }

  const investors = await InvestorAccess.find({ businessId: req.params.id })
    .populate("investorId", "name email role")
    .populate("grantedBy", "name")
    .sort({ createdAt: -1 })

  return success(res, { investors })
})

/**
 * GET /api/admin/audit-logs
 * Admin only. Fetch platform audit logs.
 */
const getAuditLogs = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    return error(res, "Only admins can view audit logs.", 403)
  }

  const { limit = 50, cursor } = req.query
  const pageLimit = Math.min(parseInt(limit, 10), 100)

  const filter = {}
  if (cursor) filter._id = { $lt: cursor }

  const logs = await AuditLog.find(filter)
    .populate("userId", "name email role")
    .sort({ _id: -1 })
    .limit(pageLimit + 1)

  const hasMore = logs.length > pageLimit
  const results = hasMore ? logs.slice(0, pageLimit) : logs
  const nextCursor = hasMore ? results[results.length - 1]._id : null

  return success(res, { logs: results, nextCursor, hasMore })
})

module.exports = {
  listUsers,
  createUser,
  toggleUserStatus,
  getBusinessInvestors,
  getAuditLogs,
}
