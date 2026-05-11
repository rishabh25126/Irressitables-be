const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    startupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Startup',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Document name is required'],
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['legal', 'financial', 'due-diligence', 'compliance', 'pitch-deck'],
    },
    s3Key: {
      type: String,
      required: true, // Full S3 object key — never expose directly; always generate signed URL
    },
    fileSize: {
      type: Number, // bytes
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    accessLevel: {
      type: String,
      enum: ['public', 'investor'],
      default: 'investor',
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Index for efficient lookups by startup
documentSchema.index({ startupId: 1, category: 1 });

const Document = mongoose.model('Document', documentSchema);
module.exports = Document;
