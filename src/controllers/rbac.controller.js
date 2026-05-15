const AuditLog = require("../models/AuditLog")
const Permission = require("../models/Permission")
const Role = require("../models/Role")
const RolePermission = require("../models/RolePermission")
const { success, error } = require("../utils/apiResponse")
const asyncHandler = require("../utils/asyncHandler")
const {
  BUILTIN_ROLE_KEYS,
  getAllPermissionKeys,
  getRolePermissions,
  hasPermission,
} = require("../utils/rbac")

function slugifyRoleKey(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

async function mapRole(role) {
  const permissions = Array.from(await getRolePermissions(role.key)).sort()
  return {
    id: role._id,
    key: role.key,
    name: role.name,
    description: role.description,
    baseRole: role.baseRole,
    isSystem: role.isSystem,
    isEditable: role.isEditable,
    permissions,
  }
}

const listPermissions = asyncHandler(async (req, res) => {
  if (!hasPermission(req.user, "settings.manage_rbac")) {
    return error(res, "You do not have permission to view permissions.", 403)
  }

  const permissions = await Permission.find({}).sort({ category: 1, key: 1 }).lean()
  return success(res, { permissions })
})

const listRoles = asyncHandler(async (req, res) => {
  if (!hasPermission(req.user, "settings.manage_rbac")) {
    return error(res, "You do not have permission to view roles.", 403)
  }

  const roles = await Role.find({}).sort({ isSystem: -1, key: 1 })
  const currentBaseRole = req.user.baseRole || req.user.role
  const visibleRoles = roles.filter((role) => {
    if (role.key === "super_admin") {
      return currentBaseRole === "super_admin"
    }

    return true
  })

  const mapped = await Promise.all(visibleRoles.map(mapRole))
  return success(res, { roles: mapped })
})

const createRole = asyncHandler(async (req, res) => {
  if (!hasPermission(req.user, "role.create")) {
    return error(res, "You do not have permission to create roles.", 403)
  }

  const { key, name, description, baseRole, permissions = [] } = req.body
  const normalizedKey = slugifyRoleKey(key || name)

  if (!normalizedKey) {
    return error(res, "Role key is required.", 400)
  }

  if (BUILTIN_ROLE_KEYS.includes(normalizedKey)) {
    return error(res, "Built-in role keys are reserved.", 400)
  }

  if (!["admin", "owner", "investor"].includes(baseRole)) {
    return error(res, "Custom roles must inherit admin, owner, or investor.", 400)
  }

  const existingRole = await Role.findOne({ key: normalizedKey })
  if (existingRole) {
    return error(res, "Role key already exists.", 409)
  }

  const role = await Role.create({
    key: normalizedKey,
    name,
    description,
    baseRole,
    isSystem: false,
    isEditable: true,
  })

  const sanitizedPermissions = Array.from(
    new Set(
      (Array.isArray(permissions) ? permissions : [])
        .map((entry) => String(entry).toLowerCase())
        .filter((key) => getAllPermissionKeys().includes(key))
    )
  )

  if (sanitizedPermissions.length > 0) {
    const basePermissions = await getRolePermissions(baseRole)
    const inserts = []

    for (const permissionKey of getAllPermissionKeys()) {
      const wantsPermission = sanitizedPermissions.includes(permissionKey)
      const baseHasPermission = basePermissions.has(permissionKey)

      if (wantsPermission && !baseHasPermission) {
        inserts.push({ roleId: role._id, permissionKey, effect: "allow" })
      } else if (!wantsPermission && baseHasPermission) {
        inserts.push({ roleId: role._id, permissionKey, effect: "deny" })
      }
    }

    if (inserts.length > 0) {
      await RolePermission.insertMany(inserts)
    }
  }

  await AuditLog.create({
    userId: req.user._id,
    action: "CREATE_ROLE",
    resource: "Role",
    resourceId: role._id,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  })

  return success(res, { role: await mapRole(role) }, "Role created.", 201)
})

const updateRole = asyncHandler(async (req, res) => {
  if (!hasPermission(req.user, "role.update")) {
    return error(res, "You do not have permission to update roles.", 403)
  }

  const role = await Role.findById(req.params.id)
  if (!role) {
    return error(res, "Role not found.", 404)
  }

  const currentBaseRole = req.user.baseRole || req.user.role
  if (role.key === "super_admin") {
    return error(res, "Super admin role cannot be edited.", 403)
  }
  if (role.key === "admin" && currentBaseRole !== "super_admin") {
    return error(res, "Only super admins can edit the admin role.", 403)
  }
  if (role.isSystem && !["owner", "investor", "admin"].includes(role.key)) {
    return error(res, "This system role cannot be edited.", 403)
  }

  const { name, description, permissions = [] } = req.body
  role.name = name ?? role.name
  role.description = description ?? role.description
  await role.save()

  await RolePermission.deleteMany({ roleId: role._id })

  const desiredPermissions = Array.from(
    new Set(
      (Array.isArray(permissions) ? permissions : [])
        .map((entry) => String(entry).toLowerCase())
        .filter((key) => getAllPermissionKeys().includes(key))
    )
  )

  const baseRoleKey = role.baseRole || role.key
  const basePermissions = role.baseRole
    ? await getRolePermissions(role.baseRole)
    : new Set()

  const entries = []

  if (role.baseRole) {
    for (const permissionKey of getAllPermissionKeys()) {
      const wantsPermission = desiredPermissions.includes(permissionKey)
      const baseHasPermission = basePermissions.has(permissionKey)

      if (wantsPermission && !baseHasPermission) {
        entries.push({ roleId: role._id, permissionKey, effect: "allow" })
      } else if (!wantsPermission && baseHasPermission) {
        entries.push({ roleId: role._id, permissionKey, effect: "deny" })
      }
    }
  } else {
    for (const permissionKey of desiredPermissions) {
      entries.push({ roleId: role._id, permissionKey, effect: "allow" })
    }
  }

  if (entries.length > 0) {
    await RolePermission.insertMany(entries)
  }

  await AuditLog.create({
    userId: req.user._id,
    action: "UPDATE_ROLE",
    resource: "Role",
    resourceId: role._id,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  })

  return success(
    res,
    { role: await mapRole(role), baseRoleKey },
    "Role updated."
  )
})

module.exports = {
  listPermissions,
  listRoles,
  createRole,
  updateRole,
}
