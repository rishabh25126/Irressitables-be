const express = require("express")
const {
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
} = require("../controllers/admin.controller")
const {
  listPermissions,
  listRoles,
  createRole,
  updateRole,
} = require("../controllers/rbac.controller")
const { protect } = require("../middleware/auth.middleware")
const { requireRole } = require("../middleware/role.middleware")

const router = express.Router()

router.use(protect, requireRole("super_admin", "admin", "owner"))

router.get("/users", listUsers)
router.get("/users/:id", getUserById)
router.get("/users/:id/access", getUserAccess)
router.post("/users", createUser)
router.patch("/users/:id/role", updateUserRole)
router.patch("/users/:id/permissions", updateUserPermissions)
router.patch("/users/:id/deactivate", toggleUserStatus)
router.post("/users/:id/promote-super-admin", promoteSuperAdmin)
router.get("/businesses/:id/investors", getBusinessInvestors)
router.get("/audit-logs", getAuditLogs)
router.get("/permissions", listPermissions)
router.get("/roles", listRoles)
router.post("/roles", createRole)
router.patch("/roles/:id", updateRole)

module.exports = router
