const express = require("express")
const {
  getMyBusinesses,
  assign,
  revoke,
  getInvestorsForBusiness,
} = require("../controllers/investorAccess.controller")
const { protect } = require("../middleware/auth.middleware")
const { requireRole } = require("../middleware/role.middleware")

const router = express.Router()

router.use(protect)

// Investor
router.get("/my-businesses", requireRole("investor"), getMyBusinesses)

// Admin / Owner management and detail access
router.get(
  "/business/:id",
  requireRole("super_admin", "admin", "owner", "investor"),
  getInvestorsForBusiness
)
router.use(requireRole("super_admin", "admin", "owner"))
router.post("/assign", assign)
router.delete("/revoke", revoke)

module.exports = router
