const mongoose = require("mongoose")

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
      // e.g. 'LOGIN', 'DOCUMENT_DOWNLOAD', 'STARTUP_CREATE', 'ACCESS_GRANTED'
    },
    resource: {
      type: String, // e.g. 'Document', 'Business', 'User'
      default: null,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    ip: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
)

// Index for fast user-specific audit trail queries
auditLogSchema.index({ userId: 1, createdAt: -1 })

const AuditLog = mongoose.model("AuditLog", auditLogSchema)
module.exports = AuditLog
