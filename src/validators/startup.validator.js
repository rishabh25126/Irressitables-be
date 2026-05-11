const { z } = require('zod');

const SECTORS = ['Fintech', 'HealthTech', 'EdTech', 'SaaS', 'E-commerce', 'CleanTech', 'AgriTech', 'DeepTech', 'Other'];
const STAGES = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C+'];

const createStartupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').trim(),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only')
    .trim(),
  tagline: z.string().max(160).trim().optional(),
  sector: z.enum(SECTORS, { errorMap: () => ({ message: 'Invalid sector' }) }),
  stage: z.enum(STAGES, { errorMap: () => ({ message: 'Invalid stage' }) }),
  description: z.string().trim().optional(),
  problem: z.string().trim().optional(),
  solution: z.string().trim().optional(),
  team: z
    .array(
      z.object({
        name: z.string().min(1),
        role: z.string().min(1),
        linkedin: z.string().url().optional().nullable(),
      })
    )
    .optional(),
  metrics: z
    .object({
      revenueRange: z.string().optional().nullable(),
      growthPercent: z.number().optional().nullable(),
      userBase: z.string().optional().nullable(),
      runway: z.string().optional().nullable(),
    })
    .optional(),
  fundingAsk: z.number().positive('Funding ask must be a positive number'),
  useOfFunds: z.string().trim().optional(),
});

const updateStartupSchema = createStartupSchema.partial();

module.exports = { createStartupSchema, updateStartupSchema };
