const mongoose = require('mongoose');

const investorAccessSchema = new mongoose.Schema(
  {
    investorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
    },
    investedAmount: {
      type: Number,
      default: 0,
    },
    shares: {
      type: Number,
      default: 0,
    },
    equityPercentage: {
      type: Number,
      default: 0,
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate access grants for same investor+business pair
investorAccessSchema.index({ investorId: 1, businessId: 1 }, { unique: true });

const InvestorAccess = mongoose.model('InvestorAccess', investorAccessSchema);
module.exports = InvestorAccess;
