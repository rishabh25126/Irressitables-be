const { error } = require('../utils/apiResponse');

/**
 * Validates request body against a Zod schema.
 * Returns 400 with field-level error details if validation fails.
 *
 * Usage: router.post('/login', validate(loginSchema), handler)
 */
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const issues = result.error.issues || result.error.errors || [];
    const errors = issues.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors,
    });
  }

  // Replace req.body with the parsed (and sanitized) data
  req.body = result.data;
  next();
};

module.exports = { validate };
