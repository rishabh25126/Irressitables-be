const mongoose = require("mongoose")

const rolePermissionSchema = new mongoose.Schema(
  {
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
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
      default: "allow",
    },
  },
  { timestamps: true }
)

rolePermissionSchema.index({ roleId: 1, permissionKey: 1 }, { unique: true })

const RolePermission = mongoose.model("RolePermission", rolePermissionSchema)
module.exports = RolePermission
