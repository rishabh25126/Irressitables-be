const express = require("express")
const {
  createRequest,
  createInterestRequest,
  getAdminRequests,
  updateRequestStatus,
  convertRequest,
} = require("../controllers/request.controller")
const { protect } = require("../middleware/auth.middleware")
const { requireRole } = require("../middleware/role.middleware")

const router = express.Router()

// Public routes
router.post("/interest", createInterestRequest)

router.use(protect)

// Investor routes
router.post("/", requireRole("investor"), createRequest)

// Admin / Owner review routes
router.get(
  "/admin",
  requireRole("super_admin", "admin", "owner"),
  getAdminRequests
)
router.patch(
  "/admin/:id",
  requireRole("super_admin", "admin", "owner"),
  updateRequestStatus
)
router.post(
  "/admin/:id/convert",
  requireRole("super_admin", "admin", "owner"),
  convertRequest
)

module.exports = router
