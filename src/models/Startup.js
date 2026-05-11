const mongoose = require('mongoose');

const startupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Startup name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    tagline: {
      type: String,
      trim: true,
      maxlength: 160,
    },
    sector: {
      type: String,
      required: [true, 'Sector is required'],
      enum: ['Fintech', 'HealthTech', 'EdTech', 'SaaS', 'E-commerce', 'CleanTech', 'AgriTech', 'DeepTech', 'Other'],
    },
    stage: {
      type: String,
      required: true,
      enum: ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C+'],
    },
    logo: {
      type: String, // S3 key
      default: null,
    },
    description: {
      type: String,
      trim: true,
    },
    problem: {
      type: String,
      trim: true,
    },
    solution: {
      type: String,
      trim: true,
    },
    team: [
      {
        name: { type: String, required: true },
        role: { type: String, required: true },
        photo: { type: String, default: null }, // S3 key
        linkedin: { type: String, default: null },
      },
    ],
    metrics: {
      revenueRange: { type: String, default: null },   // e.g. "₹1Cr - ₹5Cr"
      growthPercent: { type: Number, default: null },
      userBase: { type: String, default: null },       // e.g. "50,000+ users"
      runway: { type: String, default: null },         // e.g. "18 months"
    },
    fundingAsk: {
      type: Number, // In INR
      required: [true, 'Funding ask is required'],
    },
    useOfFunds: {
      type: String,
      trim: true,
    },
    pitchDeckKey: {
      type: String, // S3 key — access via signed URL only
      default: null,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Full-text search index on key public fields
startupSchema.index({ name: 'text', tagline: 'text', sector: 'text' });

// Fast filter queries
startupSchema.index({ sector: 1, stage: 1, isPublished: 1 });

const Startup = mongoose.model('Startup', startupSchema);
module.exports = Startup;
