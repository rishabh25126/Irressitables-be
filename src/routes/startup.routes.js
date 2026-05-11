const express = require('express');
const { getAll, getOne, create, update, remove, togglePublish } = require('../controllers/startup.controller');
const { protect } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const { createStartupSchema, updateStartupSchema } = require('../validators/startup.validator');

const router = express.Router();

// Public routes
router.get('/', getAll);
router.get('/:slug', getOne);

// Admin routes
router.use(protect, requireRole('admin'));
router.post('/', validate(createStartupSchema), create);
router.put('/:id', validate(updateStartupSchema), update);
router.delete('/:id', remove);
router.patch('/:id/publish', togglePublish);

module.exports = router;
