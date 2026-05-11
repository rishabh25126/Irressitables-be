const Startup = require('../models/Startup');
const { success, error } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/startups
 * Public. Paginated, filterable, searchable.
 * Query params: sector, stage, search, cursor, limit
 */
const getAll = asyncHandler(async (req, res) => {
  const { sector, stage, search, cursor, limit = 12 } = req.query;
  const pageLimit = Math.min(parseInt(limit), 50); // cap at 50

  const filter = { isPublished: true };

  if (sector) filter.sector = sector;
  if (stage) filter.stage = stage;
  if (search) filter.$text = { $search: search };

  // Cursor-based pagination using _id
  if (cursor) filter._id = { $lt: cursor };

  const startups = await Startup.find(filter)
    .select('name slug tagline sector stage logo metrics fundingAsk createdAt')
    .sort({ _id: -1 })
    .limit(pageLimit + 1); // fetch one extra to determine if there's a next page

  const hasMore = startups.length > pageLimit;
  const results = hasMore ? startups.slice(0, pageLimit) : startups;
  const nextCursor = hasMore ? results[results.length - 1]._id : null;

  return success(res, { startups: results, nextCursor, hasMore });
});

/**
 * GET /api/startups/:slug
 * Public. Returns full public profile for a single startup.
 */
const getOne = asyncHandler(async (req, res) => {
  const startup = await Startup.findOne({
    slug: req.params.slug,
    isPublished: true,
  }).populate('createdBy', 'name');

  if (!startup) return error(res, 'Startup not found.', 404);

  return success(res, { startup });
});

/**
 * POST /api/startups
 * Admin only. Creates a new startup (unpublished by default).
 */
const create = asyncHandler(async (req, res) => {
  const startup = await Startup.create({
    ...req.body,
    createdBy: req.user._id,
  });

  return success(res, { startup }, 'Startup created successfully.', 201);
});

/**
 * PUT /api/startups/:id
 * Admin only. Updates a startup's details.
 */
const update = asyncHandler(async (req, res) => {
  const startup = await Startup.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  );

  if (!startup) return error(res, 'Startup not found.', 404);

  return success(res, { startup }, 'Startup updated.');
});

/**
 * DELETE /api/startups/:id
 * Admin only. Permanently deletes a startup.
 */
const remove = asyncHandler(async (req, res) => {
  const startup = await Startup.findByIdAndDelete(req.params.id);

  if (!startup) return error(res, 'Startup not found.', 404);

  return success(res, null, 'Startup deleted.');
});

/**
 * PATCH /api/startups/:id/publish
 * Admin only. Toggles the published state of a startup.
 */
const togglePublish = asyncHandler(async (req, res) => {
  const startup = await Startup.findById(req.params.id);

  if (!startup) return error(res, 'Startup not found.', 404);

  startup.isPublished = !startup.isPublished;
  await startup.save();

  const state = startup.isPublished ? 'published' : 'unpublished';
  return success(res, { isPublished: startup.isPublished }, `Startup ${state}.`);
});

module.exports = { getAll, getOne, create, update, remove, togglePublish };
