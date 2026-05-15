const mongoose = require("mongoose")

const roleSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    baseRole: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    isEditable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
)

roleSchema.index({ isSystem: 1, baseRole: 1 })

const Role = mongoose.model("Role", roleSchema)
module.exports = Role
