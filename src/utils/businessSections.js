const { SECTION_TYPES, SECTION_VISIBILITIES } = require("../models/BusinessSection")

const VISIBILITY_RANK = {
  public: 1,
  investor: 2,
  "owner-admin": 3,
}

function getSectionState(section, audience = "manage") {
  if (audience === "manage") {
    return section.draftState || section.publishedState
  }

  return section.publishedState
}

function canAudienceSeeVisibility(visibility, audience) {
  if (audience === "manage") return true
  if (!visibility) return false

  const audienceRank = VISIBILITY_RANK[audience] || 0
  return audienceRank >= (VISIBILITY_RANK[visibility] || 0)
}

function canAudienceSeeDocument(document, audience) {
  if (audience === "manage") return true
  if (!document?.accessLevel) return false

  if (audience === "public") {
    return document.accessLevel === "public"
  }

  if (audience === "investor") {
    return document.accessLevel === "public" || document.accessLevel === "investor"
  }

  return true
}

function serializeDocument(document) {
  return {
    _id: document._id,
    id: String(document._id),
    businessId: document.businessId,
    name: document.name,
    category: document.category,
    fileSize: document.fileSize,
    mimeType: document.mimeType,
    accessLevel: document.accessLevel,
    description: document.description || "",
    sectionId: document.sectionId || null,
    displayOrder: document.displayOrder || 0,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  }
}

function serializeSection(section, audience = "manage") {
  const state = getSectionState(section, audience)

  if (!state || !state.isEnabled) return null
  if (!canAudienceSeeVisibility(state.visibility, audience)) return null

  const attachments = (state.attachments || [])
    .filter((document) => canAudienceSeeDocument(document, audience))
    .map(serializeDocument)

  return {
    _id: section._id,
    id: String(section._id),
    businessId: section.businessId,
    type: section.type,
    title: state.title,
    description: state.description || "",
    visibility: state.visibility,
    sortOrder: state.sortOrder || 0,
    isEnabled: state.isEnabled,
    content: state.content || {},
    attachments,
    hasDraft: Boolean(section.draftState),
    publishedAt: section.publishedAt,
  }
}

function sortSections(a, b) {
  return (a.sortOrder || 0) - (b.sortOrder || 0)
}

module.exports = {
  SECTION_TYPES,
  SECTION_VISIBILITIES,
  getSectionState,
  canAudienceSeeVisibility,
  canAudienceSeeDocument,
  serializeDocument,
  serializeSection,
  sortSections,
}
