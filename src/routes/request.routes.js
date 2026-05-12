const express = require('express');
const { createRequest, getPendingRequests, updateRequestStatus } = require('../controllers/request.controller');
const { protect } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

const router = express.Router();

router.use(protect);

// Investor routes
router.post('/', requireRole('investor'), createRequest);

// Admin routes
router.get('/admin/pending', requireRole('admin'), getPendingRequests);
router.patch('/admin/:id', requireRole('admin'), updateRequestStatus);

module.exports = router;
