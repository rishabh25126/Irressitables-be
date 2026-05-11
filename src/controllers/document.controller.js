const Document = require('../models/Document');
const AuditLog = require('../models/AuditLog');
const InvestorAccess = require('../models/InvestorAccess');
const { uploadToS3, getPresignedUrl, deleteFromS3 } = require('../utils/s3');
const { success, error } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { v4: uuidv4 } = require('uuid');

/**
 * GET /api/startups/:id/documents
 * Investor + Admin. Lists documents for a startup.
 * Investors must have access to the startup.
 */
const getByStartup = asyncHandler(async (req, res) => {
  const startupId = req.params.id;

  // Investors: verify they have access to this startup
  if (req.user.role === 'investor') {
    const access = await InvestorAccess.findOne({
      investorId: req.user._id,
      startupId,
    });
    if (!access) return error(res, 'You do not have access to this startup.', 403);
  }

  const documents = await Document.find({ startupId })
    .select('-s3Key') // Never expose raw S3 key to client
    .sort({ createdAt: -1 });

  return success(res, { documents });
});

/**
 * POST /api/startups/:id/documents
 * Admin only. Uploads a file to S3 and saves metadata in DB.
 * Expects multipart/form-data with fields: name, category, accessLevel
 */
const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) return error(res, 'No file uploaded.', 400);

  const { name, category, accessLevel = 'investor' } = req.body;
  const startupId = req.params.id;

  // Build a unique, organized S3 key
  const ext = req.file.originalname.split('.').pop();
  const s3Key = `documents/${startupId}/${uuidv4()}.${ext}`;

  await uploadToS3({
    buffer: req.file.buffer,
    key: s3Key,
    mimeType: req.file.mimetype,
  });

  const document = await Document.create({
    startupId,
    name,
    category,
    s3Key,
    fileSize: req.file.size,
    mimeType: req.file.mimetype,
    accessLevel,
    uploadedBy: req.user._id,
  });

  return success(res, { document }, 'Document uploaded.', 201);
});

/**
 * GET /api/documents/:id/download
 * Investor + Admin. Returns a pre-signed S3 URL valid for 15 minutes.
 * Logs the download in the audit trail.
 */
const getDownloadUrl = asyncHandler(async (req, res) => {
  const document = await Document.findById(req.params.id).select('+s3Key');

  if (!document) return error(res, 'Document not found.', 404);

  // Investors: check startup access
  if (req.user.role === 'investor') {
    const access = await InvestorAccess.findOne({
      investorId: req.user._id,
      startupId: document.startupId,
    });
    if (!access) return error(res, 'You do not have access to this document.', 403);
  }

  const url = await getPresignedUrl(document.s3Key, 900); // 15 minutes

  // Audit log the download
  await AuditLog.create({
    userId: req.user._id,
    action: 'DOCUMENT_DOWNLOAD',
    resource: 'Document',
    resourceId: document._id,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  return success(res, { url, expiresInSeconds: 900 });
});

/**
 * DELETE /api/documents/:id
 * Admin only. Deletes from S3 and removes DB record.
 */
const remove = asyncHandler(async (req, res) => {
  const document = await Document.findById(req.params.id).select('+s3Key');

  if (!document) return error(res, 'Document not found.', 404);

  await deleteFromS3(document.s3Key);
  await document.deleteOne();

  return success(res, null, 'Document deleted.');
});

module.exports = { getByStartup, uploadDocument, getDownloadUrl, remove };
