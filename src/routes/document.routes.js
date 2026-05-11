const express = require('express');
const { getByStartup, uploadDocument, getDownloadUrl, remove } = require('../controllers/document.controller');
const { protect } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const { upload, handleUploadError } = require('../middleware/upload.middleware');

const router = express.Router();

router.use(protect);

// Investor + Admin
router.get('/startup/:id', getByStartup);
router.get('/:id/download', getDownloadUrl);

// Admin only
router.post('/startup/:id', requireRole('admin'), upload.single('file'), handleUploadError, uploadDocument);
router.delete('/:id', requireRole('admin'), remove);

module.exports = router;
