const crypto = require("crypto")

const User = require("../models/User")
const AuditLog = require("../models/AuditLog")
const InvestorAccess = require("../models/InvestorAccess")
const OwnerAccess = require("../models/OwnerAccess")
const UserPermissionOverride = require("../models/UserPermissionOverride")
const { success, error } = require("../utils/apiResponse")
const asyncHandler = require("../utils/asyncHandler")
const { canManageBusiness } = require("../utils/businessAccess")
const {
  buildAccessProfile,
  buildUserResponse,
  getRoleByKey,
  hasPermission,
  resolveBaseRole,
} = require("../utils/rbac")

async function canOwnerSeeInvestor(ownerId, investorId) {
  const ownedBusinessIds = await OwnerAccess.find({ ownerId }).distinct("businessId")
  const visibleInvestorIds = await InvestorAccess.find({
    businessId: { $in: ownedBusinessIds },
  }).distinct("investorId")

  return visibleInvestorIds.some((id) => String(id) === String(investorId))
}

async function listVisibleUsersForManager(req, requestedRole) {
  const effectiveRole = req.user.baseRole || req.user.role

  const users = await User.find({}).select(
    "-passwordHash -refreshToken -refreshTokenIssuedAt"
  )

  const enriched = await Promise.all(
    users.map(async (user) => {
      const accessProfile = await buildAccessProfile(user)
      return {
        user,
        accessProfile,
      }
    })
  )

  let visible = enriched

  if (effectiveRole === "owner") {
    const ownedBusinessIds = await OwnerAccess.find({ ownerId: req.user._id }).distinct(
      "businessId"
    )
    const visibleInvestorIds = await InvestorAccess.find({
      businessId: { $in: ownedBusinessIds },
    }).distinct("investorId")

    const visibleInvestorIdSet = new Set(visibleInvestorIds.map((id) => String(id)))
    visible = enriched.filter(
      ({ user, accessProfile }) =>
        accessProfile.baseRole === "investor" &&
        visibleInvestorIdSet.has(String(user._id))
    )
  } else {
    visible = enriched.filter(({ accessProfile }) => {
      if (accessProfile.baseRole === "super_admin") {
        return req.user.baseRole === "super_admin"
      }

      return true
    })
  }

  if (requestedRole !== "all") {
    visible = visible.filter(
      ({ user, accessProfile }) =>
        accessProfile.baseRole === requestedRole || user.role === requestedRole
    )
  }

  return { visible }
}

/**
 * GET /api/admin/users
 */
const listUsers = asyncHandler(async (req, res) => {
  const { limit = 50, page = 1, role = "all" } = req.query
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100)
  const safePage = Math.max(parseInt(page, 10) || 1, 1)

  const effectiveRole = req.user.baseRole || req.user.role
  if (effectiveRole === "owner" && !["all", "investor"].includes(role)) {
    return error(res, "Owners can only view investor records.", 403)
  }

  const { visible } = await listVisibleUsersForManager(req, role)
  const start = (safePage - 1) * safeLimit
  const pagedUsers = visible.slice(start, start + safeLimit)

  const responseUsers = pagedUsers.map(({ user, accessProfile }) =>
    buildUserResponse(user, accessProfile)
  )

  return success(res, {
    users: responseUsers,
    investors: responseUsers.filter((user) => user.baseRole === "investor"),
    owners: responseUsers.filter((user) => user.baseRole === "owner"),
    admins: responseUsers.filter((user) => user.baseRole === "admin"),
    pagination: {
      total: visible.length,
      page: safePage,
      pages: Math.max(Math.ceil(visible.length / safeLimit), 1),
    },
  })
})

/**
 * GET /api/admin/users/:id
 */
const getUserById = asyncHandler(async (req, res) => {
  const targetUser = await User.findById(req.params.id).select(
    "-passwordHash -refreshToken -refreshTokenIssuedAt"
  )

  if (!targetUser) {
    return error(res, "User not found.", 404)
  }

  const accessProfile = await buildAccessProfile(targetUser)
  const targetBaseRole = accessProfile.baseRole
  const currentBaseRole = req.user.baseRole || req.user.role

  if (targetBaseRole === "super_admin" && currentBaseRole !== "super_admin") {
    return error(res, "Super admin accounts are restricted.", 403)
  }

  if (currentBaseRole === "owner") {
    if (targetBaseRole !== "investor") {
      return error(res, "Owners can only view investor records.", 403)
    }

    const canSeeInvestor = await canOwnerSeeInvestor(req.user._id, targetUser._id)
    if (!canSeeInvestor) {
      return error(res, "You do not have access to this investor.", 403)
    }
  }

  let ownerships = []
  let investments = []

  if (targetBaseRole === "owner") {
    ownerships = await OwnerAccess.find({ ownerId: targetUser._id })
      .populate(
        "businessId",
        "name slug sector stage isPublished fundingAsk tagline"
      )
      .populate("grantedBy", "name email role")
      .sort({ createdAt: -1 })
  }

  if (targetBaseRole === "investor") {
    const investmentFilter = { investorId: targetUser._id }

    if (currentBaseRole === "owner") {
      const ownedBusinessIds = await OwnerAccess.find({
        ownerId: req.user._id,
      }).distinct("businessId")
      investmentFilter.businessId = { $in: ownedBusinessIds }
    }

    investments = await InvestorAccess.find(investmentFilter)
      .populate(
        "businessId",
        "name slug sector stage isPublished fundingAsk tagline"
      )
      .populate("grantedBy", "name email role")
      .sort({ createdAt: -1 })
  }

  return success(res, {
    user: buildUserResponse(targetUser, accessProfile),
    ownerships,
    investments,
  })
})

/**
 * POST /api/admin/users
 */
const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role = "investor" } = req.body
  const requestedRole = String(role || "investor").toLowerCase()
  const currentBaseRole = req.user.baseRole || req.user.role

  if (requestedRole === "super_admin") {
    return error(res, "Super admins must be promoted explicitly.", 400)
  }

  if (requestedRole === "admin") {
    if (!hasPermission(req.user, "admin.create") || currentBaseRole !== "super_admin") {
      return error(res, "You do not have permission to create admins.", 403)
    }
  } else if (requestedRole === "owner") {
    if (!hasPermission(req.user, "owner.create")) {
      return error(res, "You do not have permission to create owners.", 403)
    }
  } else if (requestedRole === "investor") {
    if (!hasPermission(req.user, "investor.create")) {
      return error(res, "You do not have permission to create investors.", 403)
    }
  } else {
    return error(res, "Unsupported role for direct user creation.", 400)
  }

  const existing = await User.findOne({ email: email.toLowerCase() })
  if (existing) {
    return error(res, "Email already registered.", 409, "DUPLICATE_EMAIL")
  }

  const plainPassword = password || crypto.randomBytes(8).toString("hex")
  const user = await User.create({
    name,
    email,
    passwordHash: plainPassword,
    role: requestedRole,
  })

  await AuditLog.create({
    userId: req.user._id,
    action: `CREATE_${requestedRole.toUpperCase()}`,
    resource: "User",
    resourceId: user._id,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  })

  const accessProfile = await buildAccessProfile(user)

  return success(
    res,
    {
      user: buildUserResponse(user, accessProfile),
      temporaryPassword: plainPassword,
    },
    `${requestedRole.replace("_", " ")} created.`,
    201
  )
})

/**
 * PATCH /api/admin/users/:id/deactivate
 */
const toggleUserStatus = asyncHandler(async (req, res) => {
  const targetUser = await User.findById(req.params.id)
  if (!targetUser) return error(res, "User not found.", 404)

  const accessProfile = await buildAccessProfile(targetUser)
  const targetBaseRole = accessProfile.baseRole
  const currentBaseRole = req.user.baseRole || req.user.role

  if (targetBaseRole === "super_admin") {
    return error(res, "Super admin accounts cannot be deactivated here.", 403)
  }

  if (targetBaseRole === "admin") {
    if (currentBaseRole !== "super_admin" || !hasPermission(req.user, "admin.update")) {
      return error(res, "You do not have permission to update admins.", 403)
    }
  } else if (targetBaseRole === "owner") {
    if (!hasPermission(req.user, "owner.update")) {
      return error(res, "You do not have permission to update owners.", 403)
    }
  } else if (targetBaseRole === "investor") {
    if (!hasPermission(req.user, "investor.deactivate")) {
      return error(res, "You do not have permission to update investors.", 403)
    }
  }

  targetUser.isActive = !targetUser.isActive
  if (!targetUser.isActive) {
    targetUser.refreshToken = null
  }
  await targetUser.save()

  await AuditLog.create({
    userId: req.user._id,
    action: targetUser.isActive ? "REACTIVATE_USER" : "DEACTIVATE_USER",
    resource: "User",
    resourceId: targetUser._id,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  })

  return success(res, { isActive: targetUser.isActive }, "User status updated.")
})

/**
 * GET /api/admin/businesses/:id/investors
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
    .populate("investorId", "name email role isActive")
    .populate("grantedBy", "name")
    .sort({ createdAt: -1 })

  return success(res, { investors })
})

/**
 * GET /api/admin/audit-logs
 */
const getAuditLogs = asyncHandler(async (req, res) => {
  if (!hasPermission(req.user, "settings.manage_rbac")) {
    return error(res, "You do not have permission to view audit logs.", 403)
  }

  const { limit = 50, cursor } = req.query
  const pageLimit = Math.min(parseInt(limit, 10) || 50, 100)

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

/**
 * GET /api/admin/users/:id/access
 */
const getUserAccess = asyncHandler(async (req, res) => {
  if (!hasPermission(req.user, "settings.manage_rbac")) {
    return error(res, "You do not have permission to manage access.", 403)
  }

  const targetUser = await User.findById(req.params.id).select(
    "-passwordHash -refreshToken -refreshTokenIssuedAt"
  )
  if (!targetUser) return error(res, "User not found.", 404)

  const accessProfile = await buildAccessProfile(targetUser)
  const overrides = await UserPermissionOverride.find({
    userId: targetUser._id,
  }).lean()

  return success(res, {
    user: buildUserResponse(targetUser, accessProfile),
    overrides,
  })
})

/**
 * PATCH /api/admin/users/:id/role
 */
const updateUserRole = asyncHandler(async (req, res) => {
  if (!hasPermission(req.user, "role.update")) {
    return error(res, "You do not have permission to update roles.", 403)
  }

  const { role } = req.body
  const nextRole = String(role || "").toLowerCase()
  const currentBaseRole = req.user.baseRole || req.user.role

  if (!nextRole) {
    return error(res, "A role key is required.", 400)
  }

  if (!["super_admin", "admin", "owner", "investor"].includes(nextRole)) {
    const targetRole = await getRoleByKey(nextRole)
    if (!targetRole) {
      return error(res, "Role not found.", 404)
    }
  }

  const targetUser = await User.findById(req.params.id)
  if (!targetUser) {
    return error(res, "User not found.", 404)
  }

  const targetBaseRole = await resolveBaseRole(targetUser.role)
  const nextBaseRole = await resolveBaseRole(nextRole)

  if (targetBaseRole === "super_admin" || nextBaseRole === "super_admin") {
    if (currentBaseRole !== "super_admin") {
      return error(res, "Only super admins can manage super admin roles.", 403)
    }
  }

  if (targetBaseRole === "admin" || nextBaseRole === "admin") {
    if (currentBaseRole !== "super_admin") {
      return error(res, "Only super admins can manage admin roles.", 403)
    }
  }

  targetUser.role = nextRole
  await targetUser.save()

  await AuditLog.create({
    userId: req.user._id,
    action: "UPDATE_USER_ROLE",
    resource: "User",
    resourceId: targetUser._id,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  })

  const accessProfile = await buildAccessProfile(targetUser)
  return success(res, { user: buildUserResponse(targetUser, accessProfile) }, "User role updated.")
})

/**
 * PATCH /api/admin/users/:id/permissions
 */
const updateUserPermissions = asyncHandler(async (req, res) => {
  if (!hasPermission(req.user, "permission.assign")) {
    return error(res, "You do not have permission to assign permissions.", 403)
  }

  const { overrides = [] } = req.body
  if (!Array.isArray(overrides)) {
    return error(res, "Overrides must be an array.", 400)
  }

  const targetUser = await User.findById(req.params.id)
  if (!targetUser) {
    return error(res, "User not found.", 404)
  }

  const targetBaseRole = await resolveBaseRole(targetUser.role)
  if (targetBaseRole === "super_admin") {
    return error(res, "Super admin permissions cannot be overridden.", 403)
  }

  await UserPermissionOverride.deleteMany({ userId: targetUser._id })

  const sanitizedOverrides = overrides
    .filter((entry) => entry?.permissionKey && ["allow", "deny"].includes(entry?.effect))
    .map((entry) => ({
      userId: targetUser._id,
      permissionKey: String(entry.permissionKey).toLowerCase(),
      effect: entry.effect,
    }))

  if (sanitizedOverrides.length > 0) {
    await UserPermissionOverride.insertMany(sanitizedOverrides)
  }

  await AuditLog.create({
    userId: req.user._id,
    action: "UPDATE_USER_PERMISSIONS",
    resource: "User",
    resourceId: targetUser._id,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  })

  const accessProfile = await buildAccessProfile(targetUser)
  return success(
    res,
    {
      user: buildUserResponse(targetUser, accessProfile),
      overrides: sanitizedOverrides,
    },
    "User permission overrides updated."
  )
})

/**
 * POST /api/admin/users/:id/promote-super-admin
 */
const promoteSuperAdmin = asyncHandler(async (req, res) => {
  if ((req.user.baseRole || req.user.role) !== "super_admin" || !hasPermission(req.user, "admin.promote")) {
    return error(res, "Only super admins can promote another super admin.", 403)
  }

  const targetUser = await User.findById(req.params.id)
  if (!targetUser) {
    return error(res, "User not found.", 404)
  }

  targetUser.role = "super_admin"
  await targetUser.save()

  await UserPermissionOverride.deleteMany({ userId: targetUser._id })

  await AuditLog.create({
    userId: req.user._id,
    action: "PROMOTE_SUPER_ADMIN",
    resource: "User",
    resourceId: targetUser._id,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  })

  const accessProfile = await buildAccessProfile(targetUser)
  return success(
    res,
    { user: buildUserResponse(targetUser, accessProfile) },
    "User promoted to super admin."
  )
})

module.exports = {
  listUsers,
  getUserById,
  createUser,
  toggleUserStatus,
  getBusinessInvestors,
  getAuditLogs,
  getUserAccess,
  updateUserRole,
  updateUserPermissions,
  promoteSuperAdmin,
}
