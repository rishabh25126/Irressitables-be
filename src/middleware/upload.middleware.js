const multer = require("multer")
const { error } = require("../utils/apiResponse")

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "image/png",
  "image/jpeg",
]

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB

// Use memory storage — buffer is then streamed directly to S3
const storage = multer.memoryStorage()

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(
      new Error("File type not allowed. Accepted: PDF, Excel, Word, PNG, JPG"),
      false
    )
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
})

/**
 * Multer error handler — wraps multer errors into a clean API response.
 * Use after the multer middleware in routes.
 *
 * Usage:
 *   router.post('/upload', upload.single('file'), handleUploadError, controller)
 */
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return error(res, "File too large. Maximum size is 25MB.", 400)
    }
    return error(res, err.message, 400)
  }
  if (err) {
    return error(res, err.message, 400)
  }
  next()
}

module.exports = { upload, handleUploadError }
