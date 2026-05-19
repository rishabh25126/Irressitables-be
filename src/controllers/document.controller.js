const Document = require("../models/Document")
const Business = require("../models/Business")
const AuditLog = require("../models/AuditLog")
const InvestorAccess = require("../models/InvestorAccess")
const { uploadToS3, getPresignedUrl, deleteFromS3 } = require("../utils/s3")
const { success, error } = require("../utils/apiResponse")
const asyncHandler = require("../utils/asyncHandler")
const crypto = require("crypto")
const {
  isOwnerForBusiness,
  canManageBusiness,
} = require("../utils/businessAccess")
const { hasPermission } = require("../utils/rbac")

/**
 * GET /api/businesses/:id/documents
 * Investor + Admin. Lists documents for a business.
 * Investors must have access to the business.
 */
const getByBusiness = asyncHandler(async (req, res) => {
  const businessId = req.params.id
  const effectiveRole = req.user.baseRole || req.user.role

  // Investors: verify they have access to this business
  if (effectiveRole === "investor") {
    const access = await InvestorAccess.findOne({
      investorId: req.user._id,
      businessId,
    })
    if (!access)
      return error(res, "You do not have access to this business.", 403)
  }

  if (effectiveRole === "owner") {
    const access = await isOwnerForBusiness(req.user._id, businessId)
    if (!access)
      return error(res, "You do not have access to this business.", 403)
  }

  const documents = await Document.find({ businessId })
    .select("-s3Key") // Never expose raw S3 key to client
    .sort({ displayOrder: 1, createdAt: -1 })

  return success(res, { documents })
})

/**
 * POST /api/businesses/:id/documents
 * Admin only. Uploads a file to S3 and saves metadata in DB.
 * Expects multipart/form-data with fields: name, category, accessLevel
 */
const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) return error(res, "No file uploaded.", 400)

  if (!(await canManageBusiness(req.user, req.params.id))) {
    return error(
      res,
      "You do not have permission to manage this business.",
      403
    )
  }

  if (!hasPermission(req.user, "document.upload")) {
    return error(res, "You do not have permission to upload documents.", 403)
  }

  const {
    name,
    category,
    accessLevel = "investor",
    description = "",
    sectionId = null,
    displayOrder = 0,
  } = req.body
  const businessId = req.params.id

  // Build a unique, organized S3 key
  const ext = req.file.originalname.split(".").pop()
  const s3Key = `documents/${businessId}/${crypto.randomUUID()}.${ext}`

  await uploadToS3({
    buffer: req.file.buffer,
    key: s3Key,
    mimeType: req.file.mimetype,
  })

  const document = await Document.create({
    businessId,
    name,
    category,
    s3Key,
    fileSize: req.file.size,
    mimeType: req.file.mimetype,
    accessLevel,
    description,
    sectionId,
    displayOrder: Number(displayOrder) || 0,
    uploadedBy: req.user._id,
  })

  await AuditLog.create({
    userId: req.user._id,
    action: "DOCUMENT_UPLOADED",
    resource: "Document",
    resourceId: document._id,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  })

  return success(res, { document }, "Document uploaded.", 201)
})

/**
 * GET /api/documents/:id/download
 * Investor + Admin. Returns a pre-signed S3 URL valid for 15 minutes.
 * Logs the download in the audit trail.
 */
const getDownloadUrl = asyncHandler(async (req, res) => {
  const document = await Document.findById(req.params.id).select("+s3Key")
  const effectiveRole = req.user.baseRole || req.user.role

  if (!document) return error(res, "Document not found.", 404)

  // Investors: check business access
  if (effectiveRole === "investor") {
    const access = await InvestorAccess.findOne({
      investorId: req.user._id,
      businessId: document.businessId,
    })
    if (!access)
      return error(res, "You do not have access to this document.", 403)
  }

  if (effectiveRole === "owner") {
    const access = await isOwnerForBusiness(req.user._id, document.businessId)
    if (!access)
      return error(res, "You do not have access to this document.", 403)
  }

  const url = await getPresignedUrl(document.s3Key, 900) // 15 minutes

  // Audit log the download
  await AuditLog.create({
    userId: req.user._id,
    action: "DOCUMENT_DOWNLOAD",
    resource: "Document",
    resourceId: document._id,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  })

  return success(res, { url, expiresInSeconds: 900 })
})

const getPublicDownloadUrl = asyncHandler(async (req, res) => {
  const document = await Document.findById(req.params.id)

  if (!document || document.accessLevel !== "public") {
    return error(res, "Document not found.", 404)
  }

  const business = await Business.findById(document.businessId).select(
    "isPublished"
  )
  if (!business || !business.isPublished) {
    return error(res, "Document not found.", 404)
  }

  const url = await getPresignedUrl(document.s3Key, 900)
  return success(res, { url, expiresInSeconds: 900 })
})

const updateDocument = asyncHandler(async (req, res) => {
  const document = await Document.findById(req.params.id)
  if (!document) return error(res, "Document not found.", 404)

  if (!(await canManageBusiness(req.user, document.businessId))) {
    return error(
      res,
      "You do not have permission to manage this business.",
      403
    )
  }

  if (!hasPermission(req.user, "document.update")) {
    return error(res, "You do not have permission to update documents.", 403)
  }

  const payload = {}
  for (const key of [
    "name",
    "category",
    "accessLevel",
    "description",
    "sectionId",
    "displayOrder",
  ]) {
    if (key in req.body) {
      payload[key] = req.body[key]
    }
  }

  const updated = await Document.findByIdAndUpdate(
    req.params.id,
    { $set: payload },
    { returnDocument: "after", runValidators: true }
  ).select("-s3Key")

  await AuditLog.create({
    userId: req.user._id,
    action: "DOCUMENT_UPDATED",
    resource: "Document",
    resourceId: updated._id,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  })

  return success(res, { document: updated }, "Document updated.")
})

/**
 * DELETE /api/documents/:id
 * Admin only. Deletes from S3 and removes DB record.
 */
const remove = asyncHandler(async (req, res) => {
  const document = await Document.findById(req.params.id).select("+s3Key")

  if (!document) return error(res, "Document not found.", 404)

  if (!(await canManageBusiness(req.user, document.businessId))) {
    return error(
      res,
      "You do not have permission to manage this business.",
      403
    )
  }

  if (!hasPermission(req.user, "document.delete")) {
    return error(res, "You do not have permission to delete documents.", 403)
  }

  await deleteFromS3(document.s3Key)
  await document.deleteOne()

  await AuditLog.create({
    userId: req.user._id,
    action: "DOCUMENT_DELETED",
    resource: "Document",
    resourceId: document._id,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  })

  return success(res, null, "Document deleted.")
})

module.exports = {
  getByBusiness,
  uploadDocument,
  getDownloadUrl,
  getPublicDownloadUrl,
  updateDocument,
  remove,
}
