const mongoose = require("mongoose")

const SECTION_TYPES = [
  "rich_text",
  "metrics_grid",
  "financial_table",
  "shareholding",
  "risk_factors",
  "corporate_actions",
  "ipo_status",
  "link_list",
  "document_list",
]

const SECTION_VISIBILITIES = ["public", "investor", "owner-admin"]

const sectionStateSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 400,
      default: "",
    },
    visibility: {
      type: String,
      enum: SECTION_VISIBILITIES,
      default: "public",
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    content: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    attachments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Document",
      },
    ],
  },
  { _id: false }
)

const businessSectionSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: SECTION_TYPES,
      required: true,
      default: "rich_text",
    },
    publishedState: {
      type: sectionStateSchema,
      default: null,
    },
    draftState: {
      type: sectionStateSchema,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
)

businessSectionSchema.index({ businessId: 1, type: 1 })
businessSectionSchema.index({ businessId: 1, "publishedState.sortOrder": 1 })
businessSectionSchema.index({ businessId: 1, "draftState.sortOrder": 1 })

const BusinessSection = mongoose.model("BusinessSection", businessSectionSchema)

module.exports = {
  BusinessSection,
  SECTION_TYPES,
  SECTION_VISIBILITIES,
}
