const express = require("express")
const {
  listUsers,
  createUser,
  toggleUserStatus,
  getBusinessInvestors,
  getAuditLogs,
} = require("../controllers/admin.controller")
const { protect } = require("../middleware/auth.middleware")
const { requireRole } = require("../middleware/role.middleware")

const router = express.Router()

router.use(protect, requireRole("admin", "owner"))

router.get("/users", listUsers)
router.post("/users", createUser)
router.patch("/users/:id/deactivate", toggleUserStatus)
router.get("/businesses/:id/investors", getBusinessInvestors)
router.get("/audit-logs", getAuditLogs)

module.exports = router
