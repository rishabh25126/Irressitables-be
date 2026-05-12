const mongoose = require('mongoose');

const equityRequestSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: ['NEW_INVESTMENT', 'REVISION'],
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    requestedAmount: {
      type: Number,
      required: true,
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
    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

const EquityRequest = mongoose.model('EquityRequest', equityRequestSchema);
module.exports = EquityRequest;
