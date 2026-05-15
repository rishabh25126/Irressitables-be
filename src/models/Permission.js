const mongoose = require("mongoose")

const permissionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    isSystem: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
)

permissionSchema.index({ category: 1, key: 1 })

const Permission = mongoose.model("Permission", permissionSchema)
module.exports = Permission
