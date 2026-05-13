/**
 * Standardized API response helpers.
 * Every route must use these — never send raw res.json() in controllers.
 *
 * Success shape:  { success: true,  data: {...},   message: "..." }
 * Error shape:    { success: false, error: "...",  code: "..." }
 */

const success = (res, data = null, message = "OK", statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  })
}

const error = (
  res,
  message = "Something went wrong",
  statusCode = 500,
  code = null
) => {
  return res.status(statusCode).json({
    success: false,
    error: message,
    ...(code && { code }),
  })
}

module.exports = { success, error }
