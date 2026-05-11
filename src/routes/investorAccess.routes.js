const express = require('express');
const { getMyStartups, assign, revoke, getInvestorsForStartup } = require('../controllers/investorAccess.controller');
const { protect } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

const router = express.Router();

router.use(protect);

// Investor
router.get('/my-startups', requireRole('investor'), getMyStartups);

// Admin
router.use(requireRole('admin'));
router.post('/assign', assign);
router.delete('/revoke', revoke);
router.get('/startup/:id', getInvestorsForStartup);

module.exports = router;
