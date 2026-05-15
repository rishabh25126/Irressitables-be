const express = require("express")
const {
  getByBusiness,
  uploadDocument,
  getDownloadUrl,
  remove,
} = require("../controllers/document.controller")
const { protect } = require("../middleware/auth.middleware")
const { requireRole } = require("../middleware/role.middleware")
const { upload, handleUploadError } = require("../middleware/upload.middleware")

const router = express.Router()

router.use(protect)

// Investor + Admin
router.get(
  "/business/:id",
  requireRole("investor", "owner", "admin", "super_admin"),
  getByBusiness
)
router.get(
  "/:id/download",
  requireRole("investor", "owner", "admin", "super_admin"),
  getDownloadUrl
)

// Admin only
router.post(
  "/business/:id",
  requireRole("admin", "super_admin"),
  upload.single("file"),
  handleUploadError,
  uploadDocument
)
router.delete("/:id", requireRole("admin", "super_admin"), remove)

module.exports = router
