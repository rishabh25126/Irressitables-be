const Business = require("../models/Business")
const { BusinessSection } = require("../models/BusinessSection")
const Document = require("../models/Document")
const OwnerAccess = require("../models/OwnerAccess")
const User = require("../models/User")
const { success, error } = require("../utils/apiResponse")
const asyncHandler = require("../utils/asyncHandler")
const {
  canManageBusiness,
  canViewBusinessDetails,
} = require("../utils/businessAccess")
const { hasPermission } = require("../utils/rbac")
const {
  serializeDocument,
  serializeSection,
  sortSections,
} = require("../utils/businessSections")

async function getSectionPayload(businessId, audience) {
  const sections = await BusinessSection.find({ businessId })
    .populate("publishedState.attachments")
    .populate("draftState.attachments")
    .sort({ createdAt: 1 })

  return sections
    .map((section) => serializeSection(section, audience))
    .filter(Boolean)
    .sort(sortSections)
}

async function getDocumentPayload(businessId, audience) {
  const filter = { businessId }
  if (audience === "public") {
    filter.accessLevel = "public"
  }

  const documents = await Document.find(filter).sort({
    displayOrder: 1,
    createdAt: -1,
  })

  return documents.map(serializeDocument)
}

/**
 * GET /api/businesses
 * Public. Paginated, filterable, searchable.
 * Query params: sector, stage, search, cursor, limit
 */
const getAll = asyncHandler(async (req, res) => {
  const { sector, stage, search, cursor, limit = 12 } = req.query
  const pageLimit = Math.min(parseInt(limit), 50) // cap at 50

  const filter = { isPublished: true }

  if (sector) filter.sector = sector
  if (stage) filter.stage = stage
  if (search) filter.$text = { $search: search }

  // Cursor-based pagination using _id
  if (cursor) filter._id = { $lt: cursor }

  const businesses = await Business.find(filter)
    .select("name slug tagline sector stage logo metrics fundingAsk createdAt")
    .sort({ _id: -1 })
    .limit(pageLimit + 1) // fetch one extra to determine if there's a next page

  const hasMore = businesses.length > pageLimit
  const results = hasMore ? businesses.slice(0, pageLimit) : businesses
  const nextCursor = hasMore ? results[results.length - 1]._id : null

  return success(res, { businesses: results, nextCursor, hasMore })
})

/**
 * GET /api/businesses/manage/list
 * Admin/Owner only. Returns manageable businesses.
 */
const getManageableBusinesses = asyncHandler(async (req, res) => {
  const { limit = 100 } = req.query
  const pageLimit = Math.min(parseInt(limit), 200)

  const effectiveRole = req.user.baseRole || req.user.role

  if (effectiveRole === "super_admin" || effectiveRole === "admin") {
    const businesses = await Business.find({})
      .select(
        "name slug tagline sector stage logo metrics fundingAsk isPublished createdAt"
      )
      .sort({ createdAt: -1 })
      .limit(pageLimit)

    return success(res, { businesses })
  }

  const ownerships = await OwnerAccess.find({ ownerId: req.user._id })
    .populate({
      path: "businessId",
      select:
        "name slug tagline sector stage logo metrics fundingAsk isPublished createdAt",
    })
    .sort({ createdAt: -1 })
    .limit(pageLimit)

  const businesses = ownerships
    .map((record) => record.businessId)
    .filter(Boolean)

  return success(res, { businesses })
})

/**
 * GET /api/businesses/:slug
 * Public. Returns full public profile for a single business.
 */
const getOne = asyncHandler(async (req, res) => {
  const business = await Business.findOne({
    slug: req.params.slug,
    isPublished: true,
  }).populate("createdBy", "name")

  if (!business) return error(res, "Business not found.", 404)

  const [sections, documents] = await Promise.all([
    getSectionPayload(business._id, "public"),
    getDocumentPayload(business._id, "public"),
  ])

  return success(res, { business, sections, documents })
})

/**
 * GET /api/businesses/manage/:id
 * Admin/Owner only. Returns full manageable business profile.
 */
const getManageableOne = asyncHandler(async (req, res) => {
  if (!(await canManageBusiness(req.user, req.params.id))) {
    return error(
      res,
      "You do not have permission to manage this business.",
      403
    )
  }

  const business = await Business.findById(req.params.id).populate(
    "createdBy",
    "name"
  )
  if (!business) return error(res, "Business not found.", 404)

  const owners = await OwnerAccess.find({ businessId: business._id }).populate(
    "ownerId",
    "name email role"
  )

  const [sections, documents] = await Promise.all([
    getSectionPayload(business._id, "manage"),
    getDocumentPayload(business._id, "manage"),
  ])

  return success(res, { business, owners, sections, documents })
})

/**
 * GET /api/businesses/access/:slug
 * Logged-in detail endpoint. Investors see public + investor sections/documents.
 * Owners/Admins see full manageable content.
 */
const getAccessibleOne = asyncHandler(async (req, res) => {
  const business = await Business.findOne({ slug: req.params.slug }).populate(
    "createdBy",
    "name"
  )

  if (!business) return error(res, "Business not found.", 404)

  if (!(await canViewBusinessDetails(req.user, business._id))) {
    return error(res, "You do not have access to this business.", 403)
  }

  const effectiveRole = req.user.baseRole || req.user.role
  const audience =
    effectiveRole === "investor" ? "investor" : "manage"

  const [sections, documents] = await Promise.all([
    getSectionPayload(business._id, audience),
    getDocumentPayload(business._id, audience),
  ])

  return success(res, { business, sections, documents })
})

/**
 * POST /api/businesses
 * Admin only. Creates a new business (unpublished by default).
 */
const create = asyncHandler(async (req, res) => {
  if (!hasPermission(req.user, "business.create")) {
    return error(res, "You do not have permission to create businesses.", 403)
  }

  const { ownerIds = [], ...payload } = req.body

  const owners = await User.find({
    _id: { $in: ownerIds },
    role: "owner",
  }).select("_id")
  if (owners.length !== ownerIds.length) {
    return error(res, "All assigned owners must be valid owner accounts.", 400)
  }

  const business = await Business.create({
    ...payload,
    createdBy: req.user._id,
  })

  await OwnerAccess.insertMany(
    owners.map((owner) => ({
      ownerId: owner._id,
      businessId: business._id,
      grantedBy: req.user._id,
    }))
  )

  return success(res, { business }, "Business created successfully.", 201)
})

/**
 * PUT /api/businesses/:id
 * Admin only. Updates a business's details.
 */
const update = asyncHandler(async (req, res) => {
  if (!(await canManageBusiness(req.user, req.params.id))) {
    return error(
      res,
      "You do not have permission to manage this business.",
      403
    )
  }

  if (!hasPermission(req.user, "business.update")) {
    return error(res, "You do not have permission to update businesses.", 403)
  }

  const { ownerIds, ...payload } = req.body

  const business = await Business.findByIdAndUpdate(
    req.params.id,
    { $set: payload },
    { returnDocument: "after", runValidators: true }
  )

  if (!business) return error(res, "Business not found.", 404)

  if (Array.isArray(ownerIds)) {
    const effectiveRole = req.user.baseRole || req.user.role
    if (!["super_admin", "admin"].includes(effectiveRole)) {
      return error(res, "Only admins can change business ownership.", 403)
    }

    const owners = await User.find({
      _id: { $in: ownerIds },
      role: "owner",
    }).select("_id")
    if (owners.length !== ownerIds.length || owners.length === 0) {
      return error(res, "A business must have at least one valid owner.", 400)
    }

    await OwnerAccess.deleteMany({ businessId: business._id })
    await OwnerAccess.insertMany(
      owners.map((owner) => ({
        ownerId: owner._id,
        businessId: business._id,
        grantedBy: req.user._id,
      }))
    )
  }

  return success(res, { business }, "Business updated.")
})

/**
 * DELETE /api/businesses/:id
 * Admin only. Permanently deletes a business.
 */
const remove = asyncHandler(async (req, res) => {
  if (!hasPermission(req.user, "business.delete")) {
    return error(res, "You do not have permission to delete businesses.", 403)
  }

  const business = await Business.findByIdAndDelete(req.params.id)

  if (!business) return error(res, "Business not found.", 404)

  await OwnerAccess.deleteMany({ businessId: business._id })

  return success(res, null, "Business deleted.")
})

/**
 * PATCH /api/businesses/:id/publish
 * Admin only. Toggles the published state of a business.
 */
const togglePublish = asyncHandler(async (req, res) => {
  if (!(await canManageBusiness(req.user, req.params.id))) {
    return error(
      res,
      "You do not have permission to manage this business.",
      403
    )
  }

  const business = await Business.findById(req.params.id)

  if (!business) return error(res, "Business not found.", 404)

  if (!hasPermission(req.user, "business.publish")) {
    return error(res, "You do not have permission to publish businesses.", 403)
  }

  business.isPublished = !business.isPublished
  await business.save()

  const state = business.isPublished ? "published" : "unpublished"
  return success(
    res,
    { isPublished: business.isPublished },
    `Business ${state}.`
  )
})

module.exports = {
  getAll,
  getManageableBusinesses,
  getOne,
  getAccessibleOne,
  getManageableOne,
  create,
  update,
  remove,
  togglePublish,
}
