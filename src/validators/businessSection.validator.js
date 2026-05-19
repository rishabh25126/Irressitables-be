const { z } = require("zod")
const {
  SECTION_TYPES,
  SECTION_VISIBILITIES,
} = require("../utils/businessSections")

const httpsUrlSchema = z
  .string()
  .url("Enter a valid URL")
  .refine((value) => value.startsWith("https://"), {
    message: "Only https links are allowed",
  })

const sectionTypeSchema = z.enum(SECTION_TYPES, {
  errorMap: () => ({ message: "Invalid section type" }),
})

const visibilitySchema = z.enum(SECTION_VISIBILITIES, {
  errorMap: () => ({ message: "Invalid visibility" }),
})

const richTextContentSchema = z.object({
  markdown: z.string().max(20000).default(""),
})

const metricsGridContentSchema = z.object({
  items: z
    .array(
      z.object({
        label: z.string().min(1).max(80),
        value: z.string().min(1).max(120),
        helperText: z.string().max(200).optional().default(""),
      })
    )
    .default([]),
})

const linkListContentSchema = z.object({
  links: z
    .array(
      z.object({
        label: z.string().min(1).max(120),
        url: httpsUrlSchema,
      })
    )
    .default([]),
})

const documentListContentSchema = z.object({
  documentIds: z.array(z.string().min(1)).default([]),
})

const riskFactorsContentSchema = z.object({
  items: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        description: z.string().min(1).max(1000),
      })
    )
    .default([]),
})

const shareholdingContentSchema = z.object({
  items: z
    .array(
      z.object({
        label: z.string().min(1).max(120),
        value: z.string().min(1).max(120),
      })
    )
    .default([]),
})

const corporateActionsContentSchema = z.object({
  items: z
    .array(
      z.object({
        title: z.string().min(1).max(160),
        date: z.string().max(40).optional().default(""),
        description: z.string().min(1).max(1200),
      })
    )
    .default([]),
})

const ipoStatusContentSchema = z.object({
  status: z.string().min(1).max(120),
  timeline: z.string().max(120).optional().default(""),
  notes: z.string().max(1200).optional().default(""),
})

const financialTableContentSchema = z.object({
  columns: z.array(z.string().min(1).max(80)).default([]),
  rows: z.array(z.array(z.string().max(200))).default([]),
})

function validateContentByType(type, content) {
  const schemaMap = {
    rich_text: richTextContentSchema,
    metrics_grid: metricsGridContentSchema,
    link_list: linkListContentSchema,
    document_list: documentListContentSchema,
    risk_factors: riskFactorsContentSchema,
    shareholding: shareholdingContentSchema,
    corporate_actions: corporateActionsContentSchema,
    ipo_status: ipoStatusContentSchema,
    financial_table: financialTableContentSchema,
  }

  const schema = schemaMap[type] || z.record(z.any())
  return schema.parse(content || {})
}

const baseSectionSchema = z.object({
  title: z.string().min(1).max(120).trim(),
  description: z.string().max(400).trim().optional().default(""),
  type: sectionTypeSchema,
  visibility: visibilitySchema,
  sortOrder: z.number().int().min(0).optional().default(0),
  isEnabled: z.boolean().optional().default(true),
  content: z.record(z.any()).optional().default({}),
  attachmentIds: z.array(z.string().min(1)).optional().default([]),
})

const createBusinessSectionSchema = baseSectionSchema.transform((value) => ({
  ...value,
  content: validateContentByType(value.type, value.content),
}))

const updateBusinessSectionSchema = baseSectionSchema
  .partial()
  .transform((value) => {
    if (!value.type && !value.content) {
      return value
    }

    if (!value.type) {
      return value
    }

    return {
      ...value,
      content: validateContentByType(value.type, value.content),
    }
  })

const reorderBusinessSectionsSchema = z.object({
  sectionIds: z.array(z.string().min(1)).min(1),
})

module.exports = {
  createBusinessSectionSchema,
  updateBusinessSectionSchema,
  reorderBusinessSectionsSchema,
  validateContentByType,
}
