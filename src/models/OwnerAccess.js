const mongoose = require("mongoose")

const ownerAccessSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
)

ownerAccessSchema.index({ ownerId: 1, businessId: 1 }, { unique: true })
ownerAccessSchema.index({ businessId: 1, createdAt: -1 })

const OwnerAccess = mongoose.model("OwnerAccess", ownerAccessSchema)
module.exports = OwnerAccess
