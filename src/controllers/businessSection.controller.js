const { Types } = require("mongoose")

const { BusinessSection } = require("../models/BusinessSection")
const Document = require("../models/Document")
const AuditLog = require("../models/AuditLog")
const { success, error } = require("../utils/apiResponse")
const asyncHandler = require("../utils/asyncHandler")
const { canManageBusiness } = require("../utils/businessAccess")
const { hasPermission } = require("../utils/rbac")
const { validateContentByType } = require("../validators/businessSection.validator")
const {
  getSectionState,
  serializeSection,
  sortSections,
} = require("../utils/businessSections")

async function logSectionEvent(req, action, sectionId) {
  await AuditLog.create({
    userId: req.user._id,
    action,
    resource: "BusinessSection",
    resourceId: sectionId,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  })
}

function buildDraftState(existingSection, payload) {
  const source = existingSection
    ? getSectionState(existingSection, "manage") || {}
    : {}
  return {
    title: payload.title ?? source.title ?? "Untitled Section",
    description: payload.description ?? source.description ?? "",
    visibility: payload.visibility ?? source.visibility ?? "public",
    sortOrder: payload.sortOrder ?? source.sortOrder ?? 0,
    isEnabled: payload.isEnabled ?? source.isEnabled ?? true,
    content: payload.content ?? source.content ?? {},
    attachments: payload.attachmentIds ?? source.attachments ?? [],
  }
}

function normalizeSectionIds(sectionIds) {
  return sectionIds.map((id) => new Types.ObjectId(id))
}

const listSections = asyncHandler(async (req, res) => {
  if (!(await canManageBusiness(req.user, req.params.id))) {
    return error(
      res,
      "You do not have permission to manage this business.",
      403
    )
  }

  const sections = await BusinessSection.find({ businessId: req.params.id })
    .populate("publishedState.attachments")
    .populate("draftState.attachments")
    .sort({ createdAt: 1 })

  const serializedSections = sections
    .map((section) => serializeSection(section, "manage"))
    .filter(Boolean)
    .sort(sortSections)

  return success(res, { sections: serializedSections })
})

const createSection = asyncHandler(async (req, res) => {
  if (!(await canManageBusiness(req.user, req.params.id))) {
    return error(
      res,
      "You do not have permission to manage this business.",
      403
    )
  }

  if (!hasPermission(req.user, "business.section.create")) {
    return error(res, "You do not have permission to create sections.", 403)
  }

  if (req.body.attachmentIds?.length) {
    const count = await Document.countDocuments({
      _id: { $in: normalizeSectionIds(req.body.attachmentIds) },
      businessId: req.params.id,
    })

    if (count !== req.body.attachmentIds.length) {
      return error(res, "Attachments must belong to this business.", 400)
    }
  }

  const section = await BusinessSection.create({
    businessId: req.params.id,
    type: req.body.type,
    draftState: buildDraftState(null, req.body),
    createdBy: req.user._id,
    updatedBy: req.user._id,
  })

  if (req.body.attachmentIds?.length) {
    await Document.updateMany(
      { _id: { $in: normalizeSectionIds(req.body.attachmentIds) } },
      {
        $set: {
          sectionId: section._id,
        },
      }
    )
  }

  await logSectionEvent(req, "BUSINESS_SECTION_CREATED", section._id)

  const hydrated = await BusinessSection.findById(section._id)
    .populate("publishedState.attachments")
    .populate("draftState.attachments")

  return success(
    res,
    { section: serializeSection(hydrated, "manage") },
    "Section created.",
    201
  )
})

const updateSection = asyncHandler(async (req, res) => {
  if (!(await canManageBusiness(req.user, req.params.id))) {
    return error(
      res,
      "You do not have permission to manage this business.",
      403
    )
  }

  if (!hasPermission(req.user, "business.section.update")) {
    return error(res, "You do not have permission to update sections.", 403)
  }

  const section = await BusinessSection.findOne({
    _id: req.params.sectionId,
    businessId: req.params.id,
  })
  if (!section) return error(res, "Section not found.", 404)

  if (req.body.attachmentIds?.length) {
    const count = await Document.countDocuments({
      _id: { $in: normalizeSectionIds(req.body.attachmentIds) },
      businessId: req.params.id,
    })
    if (count !== req.body.attachmentIds.length) {
      return error(res, "Attachments must belong to this business.", 400)
    }
  }

  section.type = req.body.type || section.type
  if ("content" in req.body) {
    req.body.content = validateContentByType(section.type, req.body.content)
  }
  section.draftState = buildDraftState(section, req.body)
  section.updatedBy = req.user._id
  await section.save()

  if (req.body.attachmentIds) {
    await Document.updateMany(
      {
        businessId: req.params.id,
        sectionId: section._id,
        _id: { $nin: normalizeSectionIds(req.body.attachmentIds) },
      },
      { $set: { sectionId: null } }
    )
    if (req.body.attachmentIds.length) {
      await Document.updateMany(
        { _id: { $in: normalizeSectionIds(req.body.attachmentIds) } },
        { $set: { sectionId: section._id } }
      )
    }
  }

  await logSectionEvent(req, "BUSINESS_SECTION_UPDATED", section._id)

  const hydrated = await BusinessSection.findById(section._id)
    .populate("publishedState.attachments")
    .populate("draftState.attachments")

  return success(res, { section: serializeSection(hydrated, "manage") }, "Section updated.")
})

const reorderSections = asyncHandler(async (req, res) => {
  if (!(await canManageBusiness(req.user, req.params.id))) {
    return error(
      res,
      "You do not have permission to manage this business.",
      403
    )
  }

  if (!hasPermission(req.user, "business.section.update")) {
    return error(res, "You do not have permission to reorder sections.", 403)
  }

  const sections = await BusinessSection.find({
    businessId: req.params.id,
    _id: { $in: normalizeSectionIds(req.body.sectionIds) },
  })

  if (sections.length !== req.body.sectionIds.length) {
    return error(res, "All section IDs must belong to this business.", 400)
  }

  await Promise.all(
    req.body.sectionIds.map(async (sectionId, index) => {
      const section = sections.find((item) => String(item._id) === sectionId)
      section.draftState = buildDraftState(section, { sortOrder: index })
      section.updatedBy = req.user._id
      await section.save()
    })
  )

  await AuditLog.create({
    userId: req.user._id,
    action: "BUSINESS_SECTION_REORDERED",
    resource: "Business",
    resourceId: req.params.id,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  })

  const hydrated = await BusinessSection.find({ businessId: req.params.id })
    .populate("publishedState.attachments")
    .populate("draftState.attachments")

  const serializedSections = hydrated
    .map((section) => serializeSection(section, "manage"))
    .filter(Boolean)
    .sort(sortSections)

  return success(res, { sections: serializedSections }, "Sections reordered.")
})

const removeSection = asyncHandler(async (req, res) => {
  if (!(await canManageBusiness(req.user, req.params.id))) {
    return error(
      res,
      "You do not have permission to manage this business.",
      403
    )
  }

  if (!hasPermission(req.user, "business.section.delete")) {
    return error(res, "You do not have permission to remove sections.", 403)
  }

  const section = await BusinessSection.findOne({
    _id: req.params.sectionId,
    businessId: req.params.id,
  })
  if (!section) return error(res, "Section not found.", 404)

  if (!section.publishedState) {
    await Document.updateMany({ sectionId: section._id }, { $set: { sectionId: null } })
    await section.deleteOne()
    await logSectionEvent(req, "BUSINESS_SECTION_DELETED", section._id)
    return success(res, null, "Section deleted.")
  }

  section.draftState = buildDraftState(section, { isEnabled: false })
  section.updatedBy = req.user._id
  await section.save()
  await logSectionEvent(req, "BUSINESS_SECTION_DISABLED", section._id)

  return success(res, null, "Section disabled.")
})

const publishBusinessProfile = asyncHandler(async (req, res) => {
  if (!(await canManageBusiness(req.user, req.params.id))) {
    return error(
      res,
      "You do not have permission to manage this business.",
      403
    )
  }

  if (!hasPermission(req.user, "business.publish")) {
    return error(res, "You do not have permission to publish profiles.", 403)
  }

  const sections = await BusinessSection.find({ businessId: req.params.id })

  await Promise.all(
    sections.map(async (section) => {
      if (!section.draftState) return
      section.publishedState = section.draftState
      section.draftState = null
      section.publishedAt = new Date()
      section.updatedBy = req.user._id
      await section.save()
    })
  )

  await AuditLog.create({
    userId: req.user._id,
    action: "BUSINESS_PROFILE_PUBLISHED",
    resource: "Business",
    resourceId: req.params.id,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  })

  return success(res, null, "Profile changes published.")
})

module.exports = {
  listSections,
  createSection,
  updateSection,
  reorderSections,
  removeSection,
  publishBusinessProfile,
}
