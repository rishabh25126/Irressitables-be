const mongoose = require('mongoose');

const investorAccessSchema = new mongoose.Schema(
  {
    investorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    startupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Startup',
      required: true,
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate access grants for same investor+startup pair
investorAccessSchema.index({ investorId: 1, startupId: 1 }, { unique: true });

const InvestorAccess = mongoose.model('InvestorAccess', investorAccessSchema);
module.exports = InvestorAccess;
