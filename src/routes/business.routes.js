const express = require("express")
const {
  getAll,
  getManageableBusinesses,
  getOne,
  getAccessibleOne,
  getManageableOne,
  create,
  update,
  remove,
  togglePublish,
} = require("../controllers/business.controller")
const {
  listSections,
  createSection,
  updateSection,
  reorderSections,
  removeSection,
  publishBusinessProfile,
} = require("../controllers/businessSection.controller")
const { protect } = require("../middleware/auth.middleware")
const { requireRole } = require("../middleware/role.middleware")
const { validate } = require("../middleware/validate.middleware")
const {
  createBusinessSchema,
  updateBusinessSchema,
} = require("../validators/business.validator")
const {
  createBusinessSectionSchema,
  updateBusinessSectionSchema,
  reorderBusinessSectionsSchema,
} = require("../validators/businessSection.validator")

const router = express.Router()

// Public routes
router.get("/", getAll)
router.get(
  "/access/:slug",
  protect,
  requireRole("super_admin", "admin", "owner", "investor"),
  getAccessibleOne
)
router.get(
  "/manage/list",
  protect,
  requireRole("super_admin", "admin", "owner"),
  getManageableBusinesses
)
router.get(
  "/manage/:id",
  protect,
  requireRole("super_admin", "admin", "owner"),
  getManageableOne
)
router.get("/:slug", getOne)

// Admin / Owner management routes
router.use(protect, requireRole("super_admin", "admin", "owner"))
router.post("/", validate(createBusinessSchema), create)
router.put("/:id", validate(updateBusinessSchema), update)
router.delete("/:id", remove)
router.patch("/:id/publish", togglePublish)
router.get("/:id/sections", listSections)
router.post("/:id/sections", validate(createBusinessSectionSchema), createSection)
router.patch(
  "/:id/sections/reorder",
  validate(reorderBusinessSectionsSchema),
  reorderSections
)
router.patch("/:id/profile/publish", publishBusinessProfile)
router.patch(
  "/:id/sections/:sectionId",
  validate(updateBusinessSectionSchema),
  updateSection
)
router.delete("/:id/sections/:sectionId", removeSection)

module.exports = router
