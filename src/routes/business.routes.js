const express = require("express")
const {
  getAll,
  getManageableBusinesses,
  getOne,
  getManageableOne,
  create,
  update,
  remove,
  togglePublish,
} = require("../controllers/business.controller")
const { protect } = require("../middleware/auth.middleware")
const { requireRole } = require("../middleware/role.middleware")
const { validate } = require("../middleware/validate.middleware")
const {
  createBusinessSchema,
  updateBusinessSchema,
} = require("../validators/business.validator")

const router = express.Router()

// Public routes
router.get("/", getAll)
router.get(
  "/manage/list",
  protect,
  requireRole("admin", "owner"),
  getManageableBusinesses
)
router.get(
  "/manage/:id",
  protect,
  requireRole("admin", "owner"),
  getManageableOne
)
router.get("/:slug", getOne)

// Admin / Owner management routes
router.use(protect, requireRole("admin", "owner"))
router.post("/", validate(createBusinessSchema), create)
router.put("/:id", validate(updateBusinessSchema), update)
router.delete("/:id", remove)
router.patch("/:id/publish", togglePublish)

module.exports = router
