const express = require("express")
const {
  getByBusiness,
  uploadDocument,
  getDownloadUrl,
  getPublicDownloadUrl,
  updateDocument,
  remove,
} = require("../controllers/document.controller")
const { protect } = require("../middleware/auth.middleware")
const { requireRole } = require("../middleware/role.middleware")
const { upload, handleUploadError } = require("../middleware/upload.middleware")

const router = express.Router()

router.get("/:id/public-url", getPublicDownloadUrl)

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

// Admin / Owner uploads and document management
router.post(
  "/business/:id",
  requireRole("owner", "admin", "super_admin"),
  upload.single("file"),
  handleUploadError,
  uploadDocument
)
router.patch(
  "/:id",
  requireRole("owner", "admin", "super_admin"),
  updateDocument
)
router.delete("/:id", requireRole("owner", "admin", "super_admin"), remove)

module.exports = router
