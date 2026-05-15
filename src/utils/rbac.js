const crypto = require("crypto")

const Permission = require("../models/Permission")
const Role = require("../models/Role")
const RolePermission = require("../models/RolePermission")
const User = require("../models/User")
const UserPermissionOverride = require("../models/UserPermissionOverride")

const BUILTIN_ROLE_KEYS = [
  "super_admin",
  "admin",
  "owner",
  "investor",
]

const PERMISSION_CATALOG = [
  {
    key: "business.create",
    label: "Create Businesses",
    description: "Create a new business record.",
    category: "Businesses",
  },
  {
    key: "business.update",
    label: "Edit Businesses",
    description: "Update business details.",
    category: "Businesses",
  },
  {
    key: "business.delete",
    label: "Delete Businesses",
    description: "Delete business records.",
    category: "Businesses",
  },
  {
    key: "business.publish",
    label: "Publish Businesses",
    description: "Publish or unpublish businesses.",
    category: "Businesses",
  },
  {
    key: "investor.create",
    label: "Create Investors",
    description: "Create investor accounts.",
    category: "Investors",
  },
  {
    key: "investor.update",
    label: "Edit Investors",
    description: "Update investor profile details.",
    category: "Investors",
  },
  {
    key: "investor.deactivate",
    label: "Deactivate Investors",
    description: "Deactivate or reactivate investor accounts.",
    category: "Investors",
  },
  {
    key: "investor.assign_equity",
    label: "Assign Equity",
    description: "Assign or edit investor equity.",
    category: "Investors",
  },
  {
    key: "investor.revoke_equity",
    label: "Revoke Equity",
    description: "Remove investor access from a business.",
    category: "Investors",
  },
  {
    key: "owner.create",
    label: "Create Owners",
    description: "Create owner accounts.",
    category: "Owners",
  },
  {
    key: "owner.update",
    label: "Edit Owners",
    description: "Update owner account details.",
    category: "Owners",
  },
  {
    key: "owner.assign_business",
    label: "Assign Owners",
    description: "Assign owners to businesses.",
    category: "Owners",
  },
  {
    key: "owner.revoke_business",
    label: "Revoke Owner Access",
    description: "Remove owner assignment from a business.",
    category: "Owners",
  },
  {
    key: "request.review",
    label: "Review Requests",
    description: "Review and update request status.",
    category: "Requests",
  },
  {
    key: "request.convert_to_investor",
    label: "Convert Requests",
    description: "Convert requests into investor and equity actions.",
    category: "Requests",
  },
  {
    key: "role.create",
    label: "Create Roles",
    description: "Create custom roles.",
    category: "Roles & Permissions",
  },
  {
    key: "role.update",
    label: "Edit Roles",
    description: "Edit role metadata and permission mappings.",
    category: "Roles & Permissions",
  },
  {
    key: "permission.assign",
    label: "Assign Permissions",
    description: "Assign direct permission overrides to users.",
    category: "Roles & Permissions",
  },
  {
    key: "admin.create",
    label: "Create Admins",
    description: "Create admin accounts.",
    category: "Admin Management",
  },
  {
    key: "admin.update",
    label: "Edit Admins",
    description: "Edit admin role and access assignments.",
    category: "Admin Management",
  },
  {
    key: "admin.promote",
    label: "Promote Super Admin",
    description: "Promote an admin to super admin.",
    category: "Admin Management",
  },
  {
    key: "settings.manage_rbac",
    label: "Manage RBAC Settings",
    description: "Manage role, permission, and access settings.",
    category: "Settings",
  },
]

const BUILTIN_ROLE_DEFINITIONS = {
  super_admin: {
    name: "Super Admin",
    description: "Unrestricted platform access.",
    baseRole: null,
    isSystem: true,
    isEditable: false,
  },
  admin: {
    name: "Admin",
    description: "Platform-wide operational manager.",
    baseRole: null,
    isSystem: true,
    isEditable: true,
  },
  owner: {
    name: "Owner",
    description: "Business-scoped manager.",
    baseRole: null,
    isSystem: true,
    isEditable: true,
  },
  investor: {
    name: "Investor",
    description: "Read-only invested-business viewer.",
    baseRole: null,
    isSystem: true,
    isEditable: true,
  },
}

const BUILTIN_ROLE_PERMISSION_DEFAULTS = {
  super_admin: PERMISSION_CATALOG.map((entry) => ({
    permissionKey: entry.key,
    effect: "allow",
  })),
  admin: PERMISSION_CATALOG.filter(
    (entry) => !["admin.promote"].includes(entry.key)
  ).map((entry) => ({
    permissionKey: entry.key,
    effect: "allow",
  })),
  owner: [
    "business.update",
    "investor.create",
    "investor.update",
    "investor.assign_equity",
    "investor.revoke_equity",
    "request.review",
    "request.convert_to_investor",
  ].map((permissionKey) => ({ permissionKey, effect: "allow" })),
  investor: [],
}

function getAllPermissionKeys() {
  return PERMISSION_CATALOG.map((entry) => entry.key)
}

function isBuiltInRole(roleKey) {
  return BUILTIN_ROLE_KEYS.includes(String(roleKey || "").toLowerCase())
}

async function ensurePermissionCatalog() {
  for (const entry of PERMISSION_CATALOG) {
    await Permission.findOneAndUpdate(
      { key: entry.key },
      { $set: { ...entry, isSystem: true } },
      { upsert: true, returnDocument: "after" }
    )
  }
}

async function dedupePermissionCatalog() {
  const duplicates = await Permission.aggregate([
    { $group: { _id: "$key", ids: { $push: "$_id" }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ])

  for (const duplicate of duplicates) {
    const [, ...extraIds] = duplicate.ids
    if (extraIds.length > 0) {
      await Permission.deleteMany({ _id: { $in: extraIds } })
    }
  }
}

async function dedupeBuiltInRoles() {
  for (const key of BUILTIN_ROLE_KEYS) {
    const roles = await Role.find({ key }).sort({ createdAt: 1, _id: 1 })
    if (roles.length <= 1) continue

    const canonical = roles[0]
    const duplicates = roles.slice(1)

    for (const duplicate of duplicates) {
      const duplicateEntries = await RolePermission.find({
        roleId: duplicate._id,
      }).lean()

      for (const entry of duplicateEntries) {
        const existing = await RolePermission.findOne({
          roleId: canonical._id,
          permissionKey: entry.permissionKey,
          effect: entry.effect,
        }).lean()

        if (!existing) {
          await RolePermission.create({
            roleId: canonical._id,
            permissionKey: entry.permissionKey,
            effect: entry.effect,
          })
        }
      }

      await RolePermission.deleteMany({ roleId: duplicate._id })
      await duplicate.deleteOne()
    }
  }
}

async function ensureBuiltInRoles() {
  for (const [key, definition] of Object.entries(BUILTIN_ROLE_DEFINITIONS)) {
    await Role.findOneAndUpdate(
      { key },
      { $set: { key, ...definition } },
      { upsert: true, returnDocument: "after" }
    )
  }
}

async function ensureBuiltInRolePermissions() {
  const roles = await Role.find({ key: { $in: BUILTIN_ROLE_KEYS } })
  const roleMap = new Map(roles.map((role) => [role.key, role]))

  for (const roleKey of BUILTIN_ROLE_KEYS) {
    const role = roleMap.get(roleKey)
    if (!role) continue

    const existing = await RolePermission.find({ roleId: role._id }).lean()
    if (existing.length > 0) continue

    const defaults = BUILTIN_ROLE_PERMISSION_DEFAULTS[roleKey] || []
    if (defaults.length === 0) continue

    await RolePermission.insertMany(
      defaults.map((entry) => ({
        roleId: role._id,
        permissionKey: entry.permissionKey,
        effect: entry.effect,
      }))
    )
  }
}

async function ensureDevelopmentSuperAdmin() {
  if (process.env.NODE_ENV === "production") return

  const existing = await User.findOne({ role: "super_admin" }).lean()
  if (existing) return

  const passwordHash = crypto.randomBytes(6).toString("hex")
  await User.create({
    name: "Super Admin",
    email: process.env.SUPER_ADMIN_EMAIL || "superadmin@irressitables.com",
    passwordHash: process.env.SUPER_ADMIN_PASSWORD || passwordHash,
    role: "super_admin",
  })
}

let seedPromise = null

async function ensureRbacSeed() {
  if (!seedPromise) {
    seedPromise = (async () => {
      await dedupePermissionCatalog()
      await ensurePermissionCatalog()
      await dedupeBuiltInRoles()
      await ensureBuiltInRoles()
      await ensureBuiltInRolePermissions()
      await ensureDevelopmentSuperAdmin()
    })().catch((error) => {
      seedPromise = null
      throw error
    })
  }

  return seedPromise
}

async function getRoleByKey(roleKey) {
  if (!roleKey) return null
  return Role.findOne({ key: String(roleKey).toLowerCase() })
}

async function resolveBaseRole(roleKey) {
  const normalized = String(roleKey || "").toLowerCase()
  if (isBuiltInRole(normalized)) {
    return normalized
  }

  const role = await getRoleByKey(normalized)
  if (!role) return "investor"
  return role.baseRole || "investor"
}

async function getRolePermissionEntries(roleKey) {
  const role = await getRoleByKey(roleKey)
  if (!role) {
    return []
  }

  return RolePermission.find({ roleId: role._id }).lean()
}

async function getRolePermissions(roleKey, seen = new Set()) {
  const normalized = String(roleKey || "").toLowerCase()

  if (!normalized) return new Set()
  if (normalized === "super_admin") {
    return new Set(getAllPermissionKeys())
  }

  if (seen.has(normalized)) {
    return new Set()
  }
  seen.add(normalized)

  const role = await getRoleByKey(normalized)
  if (!role) return new Set()

  let effectivePermissions = new Set()
  if (role.baseRole) {
    effectivePermissions = await getRolePermissions(role.baseRole, seen)
  }

  const entries = await getRolePermissionEntries(normalized)
  for (const entry of entries) {
    if (entry.effect === "deny") {
      effectivePermissions.delete(entry.permissionKey)
    } else {
      effectivePermissions.add(entry.permissionKey)
    }
  }

  return effectivePermissions
}

async function getUserPermissionOverrides(userId) {
  return UserPermissionOverride.find({ userId }).lean()
}

async function getEffectivePermissions(user) {
  if (!user) return []

  const roleKey = String(user.role || "").toLowerCase()
  if (roleKey === "super_admin") {
    return getAllPermissionKeys()
  }

  const rolePermissions = await getRolePermissions(roleKey)
  const overrides = await getUserPermissionOverrides(user._id)

  for (const override of overrides) {
    if (override.effect === "deny") {
      rolePermissions.delete(override.permissionKey)
    } else {
      rolePermissions.add(override.permissionKey)
    }
  }

  return Array.from(rolePermissions).sort()
}

async function buildAccessProfile(user) {
  if (!user) return null

  const roleKey = String(user.role || "").toLowerCase()
  const baseRole = await resolveBaseRole(roleKey)
  const permissions =
    roleKey === "super_admin"
      ? getAllPermissionKeys()
      : await getEffectivePermissions(user)

  return {
    roleKey,
    baseRole,
    permissions,
    isSuperAdmin: roleKey === "super_admin",
  }
}

function hasPermission(user, permissionKey) {
  if (!user) return false
  if (user.roleKey === "super_admin" || user.baseRole === "super_admin") {
    return true
  }

  return Array.isArray(user.permissions)
    ? user.permissions.includes(permissionKey)
    : false
}

function buildUserResponse(user, accessProfile) {
  return {
    id: user._id,
    _id: user._id,
    name: user.name,
    email: user.email,
    role: accessProfile.roleKey,
    baseRole: accessProfile.baseRole,
    permissions: accessProfile.permissions,
    isActive: user.isActive,
  }
}

module.exports = {
  BUILTIN_ROLE_KEYS,
  PERMISSION_CATALOG,
  BUILTIN_ROLE_DEFINITIONS,
  getAllPermissionKeys,
  isBuiltInRole,
  ensureRbacSeed,
  getRoleByKey,
  resolveBaseRole,
  getRolePermissions,
  getUserPermissionOverrides,
  getEffectivePermissions,
  buildAccessProfile,
  hasPermission,
  buildUserResponse,
}
