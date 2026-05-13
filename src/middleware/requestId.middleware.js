const crypto = require("crypto")

/**
 * Assigns a stable request id for correlation (logs, support).
 * Honors incoming X-Request-Id when present; otherwise generates a UUID.
 */
const requestId = (req, res, next) => {
  const incoming = req.get("X-Request-Id")
  req.id =
    incoming && String(incoming).trim()
      ? String(incoming).trim()
      : crypto.randomUUID()
  res.setHeader("X-Request-Id", req.id)
  next()
}

module.exports = requestId
