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
  const effectiveRole = user.baseRole || user.role
  if (effectiveRole === "super_admin" || effectiveRole === "admin") return true
  if (effectiveRole !== "owner") return false
  return isOwnerForBusiness(user._id, businessId)
}

async function canViewBusinessDetails(user, businessId) {
  if (!user) return false
  const effectiveRole = user.baseRole || user.role
  if (effectiveRole === "super_admin" || effectiveRole === "admin") return true
  if (effectiveRole === "owner") return isOwnerForBusiness(user._id, businessId)
  if (effectiveRole === "investor")
    return isInvestorForBusiness(user._id, businessId)
  return false
}

module.exports = {
  isOwnerForBusiness,
  isInvestorForBusiness,
  canManageBusiness,
  canViewBusinessDetails,
}
