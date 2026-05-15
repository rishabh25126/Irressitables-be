const mongoose = require("mongoose")

const userPermissionOverrideSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    permissionKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    effect: {
      type: String,
      enum: ["allow", "deny"],
      required: true,
    },
  },
  { timestamps: true }
)

userPermissionOverrideSchema.index(
  { userId: 1, permissionKey: 1 },
  { unique: true }
)

const UserPermissionOverride = mongoose.model(
  "UserPermissionOverride",
  userPermissionOverrideSchema
)

module.exports = UserPermissionOverride
