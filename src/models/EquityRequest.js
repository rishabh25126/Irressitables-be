const mongoose = require("mongoose")

const equityRequestSchema = new mongoose.Schema(
  {
    investorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    type: {
      type: String,
      enum: ["NEW_INVESTMENT", "REVISION", "PUBLIC_INTEREST"],
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "REVIEWING", "REJECTED", "ACCEPTED", "APPROVED"],
      default: "PENDING",
    },
    requestedAmount: {
      type: Number,
      default: 0,
    },
    requestedShares: {
      type: Number,
    },
    requestedEquityPercentage: {
      type: Number,
    },
    message: {
      type: String,
      trim: true,
    },
    contactName: {
      type: String,
      trim: true,
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
)

equityRequestSchema.index({ status: 1, createdAt: 1 })
equityRequestSchema.index({ businessId: 1, createdAt: 1 })

const EquityRequest = mongoose.model("EquityRequest", equityRequestSchema)
module.exports = EquityRequest
