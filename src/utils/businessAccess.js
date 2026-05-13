const OwnerAccess = require("../models/OwnerAccess")
const InvestorAccess = require("../models/InvestorAccess")

async function isOwnerForBusiness(userId, businessId) {
  const access = await OwnerAccess.exists({ ownerId: userId, businessId })
  return Boolean(access)
}

async function isInvestorForBusiness(userId, businessId) {
  const access = await InvestorAccess.exists({ investorId: userId, businessId })
  return Boolean(access)
}

async function canManageBusiness(user, businessId) {
  if (!user) return false
  if (user.role === "admin") return true
  if (user.role !== "owner") return false
  return isOwnerForBusiness(user._id, businessId)
}

async function canViewBusinessDetails(user, businessId) {
  if (!user) return false
  if (user.role === "admin") return true
  if (user.role === "owner") return isOwnerForBusiness(user._id, businessId)
  if (user.role === "investor")
    return isInvestorForBusiness(user._id, businessId)
  return false
}

module.exports = {
  isOwnerForBusiness,
  isInvestorForBusiness,
  canManageBusiness,
  canViewBusinessDetails,
}
