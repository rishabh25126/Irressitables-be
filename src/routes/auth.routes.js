const express = require('express');
const { login, logout, refreshToken, changePassword } = require('../controllers/auth.controller');
const { validate } = require('../middleware/validate.middleware');
const { loginSchema, changePasswordSchema } = require('../validators/auth.validator');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/login', validate(loginSchema), login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.post('/change-password', protect, validate(changePasswordSchema), changePassword);

module.exports = router;
