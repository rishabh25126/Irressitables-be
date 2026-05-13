const express = require('express');
const { getMyBusinesses, assign, revoke, getOwnersForBusiness } = require('../controllers/ownerAccess.controller');
const { protect } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

const router = express.Router();

router.use(protect);

router.get('/my-businesses', requireRole('owner'), getMyBusinesses);
router.get('/business/:id', requireRole('admin', 'owner', 'investor'), getOwnersForBusiness);
router.use(requireRole('admin'));
router.post('/assign', assign);
router.delete('/revoke', revoke);

module.exports = router;
