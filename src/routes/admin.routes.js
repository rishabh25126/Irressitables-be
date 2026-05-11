const express = require('express');
const { listInvestors, createInvestor, toggleUserStatus, getAuditLogs } = require('../controllers/admin.controller');
const { protect } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

const router = express.Router();

router.use(protect, requireRole('admin'));

router.get('/users', listInvestors);
router.post('/users', createInvestor);
router.patch('/users/:id/deactivate', toggleUserStatus);
router.get('/audit-logs', getAuditLogs);

module.exports = router;
