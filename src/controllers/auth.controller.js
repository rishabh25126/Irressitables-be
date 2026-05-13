const User = require("../models/User")
const AuditLog = require("../models/AuditLog")
const {
  signAccessToken,
  signRefreshToken,
  verifyToken,
} = require("../utils/jwt")
const { success, error } = require("../utils/apiResponse")
const asyncHandler = require("../utils/asyncHandler")
const env = require("../config/env")
const crypto = require("crypto")

const REFRESH_COOKIE_MAX_AGE = 5 * 24 * 60 * 60 * 1000

function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

function matchesStoredRefreshToken(storedToken, presentedToken) {
  if (!storedToken || !presentedToken) return false
  return (
    storedToken === hashRefreshToken(presentedToken) ||
    storedToken === presentedToken
  )
}

function isTrustedAuthOrigin(req) {
  if (env.nodeEnv !== "production") {
    return true
  }

  const origin = req.get("origin")

  if (!origin) {
    return false
  }

  return env.corsAllowedOrigins.includes(origin)
}

async function logAuthEvent(req, userId, action, resourceId) {
  await AuditLog.create({
    userId,
    action,
    resource: "User",
    resourceId,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  })
}

function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: env.nodeEnv === "production" ? "none" : "lax",
    maxAge: REFRESH_COOKIE_MAX_AGE,
  }
}

const CLEAR_REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: env.nodeEnv === "production" ? "none" : "lax",
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body

  // Select passwordHash explicitly (it's excluded by default via `select: false`)
  const user = await User.findOne({ email }).select("+passwordHash")

  if (!user || !(await user.comparePassword(password))) {
    // Generic message — don't reveal whether email exists
    return error(res, "Invalid email or password.", 401, "INVALID_CREDENTIALS")
  }

  if (!user.isActive) {
    return error(
      res,
      "Your account has been deactivated. Contact admin.",
      403,
      "ACCOUNT_INACTIVE"
    )
  }

  const accessToken = signAccessToken({ id: user._id, role: user.role })
  const refreshToken = signRefreshToken({ id: user._id })

  user.refreshToken = hashRefreshToken(refreshToken)
  user.refreshTokenIssuedAt = new Date()
  await user.save({ validateBeforeSave: false })

  res.cookie("refreshToken", refreshToken, getRefreshCookieOptions())

  await logAuthEvent(req, user._id, "LOGIN", user._id)

  return success(
    res,
    {
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
    "Login successful"
  )
})

/**
 * POST /api/auth/refresh
 * Reads refresh token from httpOnly cookie, issues a new access token.
 */
const refreshToken = asyncHandler(async (req, res) => {
  if (!isTrustedAuthOrigin(req)) {
    return error(res, "Origin not allowed.", 403, "ORIGIN_NOT_ALLOWED")
  }

  const token = req.cookies?.refreshToken

  if (!token) return error(res, "No refresh token.", 401, "NO_REFRESH_TOKEN")

  let decoded

  try {
    decoded = verifyToken(token, "refresh")
  } catch (err) {
    res.clearCookie("refreshToken", CLEAR_REFRESH_COOKIE_OPTIONS)
    const code =
      err.name === "TokenExpiredError"
        ? "REFRESH_TOKEN_EXPIRED"
        : "INVALID_REFRESH_TOKEN"
    const message =
      err.name === "TokenExpiredError"
        ? "Refresh token expired."
        : "Invalid refresh token."
    return error(res, message, 401, code)
  }

  const user = await User.findById(decoded.id).select(
    "+refreshToken +refreshTokenIssuedAt"
  )

  if (!user || !user.refreshToken) {
    res.clearCookie("refreshToken", CLEAR_REFRESH_COOKIE_OPTIONS)
    return error(res, "Invalid refresh token.", 401, "INVALID_REFRESH_TOKEN")
  }

  if (!matchesStoredRefreshToken(user.refreshToken, token)) {
    user.refreshToken = null
    user.refreshTokenIssuedAt = null
    await user.save({ validateBeforeSave: false })
    await logAuthEvent(req, user._id, "REFRESH_TOKEN_REUSE_DETECTED", user._id)
    res.clearCookie("refreshToken", CLEAR_REFRESH_COOKIE_OPTIONS)
    return error(
      res,
      "Session invalidated. Please log in again.",
      401,
      "REFRESH_TOKEN_REUSED"
    )
  }

  const newRefreshToken = signRefreshToken({ id: user._id })
  const newAccessToken = signAccessToken({ id: user._id, role: user.role })
  user.refreshToken = hashRefreshToken(newRefreshToken)
  user.refreshTokenIssuedAt = new Date()
  await user.save({ validateBeforeSave: false })

  res.cookie("refreshToken", newRefreshToken, getRefreshCookieOptions())
  await logAuthEvent(req, user._id, "REFRESH", user._id)

  return success(
    res,
    {
      accessToken: newAccessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
    "Token refreshed"
  )
})

/**
 * POST /api/auth/logout
 * Clears the refresh token from DB and cookie.
 */
const logout = asyncHandler(async (req, res) => {
  if (!isTrustedAuthOrigin(req)) {
    return error(res, "Origin not allowed.", 403, "ORIGIN_NOT_ALLOWED")
  }

  const token = req.cookies?.refreshToken

  if (token) {
    const tokenHash = hashRefreshToken(token)
    const user = await User.findOneAndUpdate(
      { refreshToken: { $in: [tokenHash, token] } },
      { refreshToken: null, refreshTokenIssuedAt: null },
      { new: true }
    )

    if (user) {
      await logAuthEvent(req, user._id, "LOGOUT", user._id)
    }
  }

  res.clearCookie("refreshToken", CLEAR_REFRESH_COOKIE_OPTIONS)
  return success(res, null, "Logged out successfully")
})

/**
 * POST /api/auth/change-password
 * Protected — requires valid access token.
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body

  const user = await User.findById(req.user._id).select("+passwordHash")

  if (!(await user.comparePassword(currentPassword))) {
    return error(res, "Current password is incorrect.", 400, "WRONG_PASSWORD")
  }

  user.passwordHash = newPassword // pre-save hook will hash it
  user.refreshToken = null // invalidate all existing sessions
  user.refreshTokenIssuedAt = null
  await user.save()

  res.clearCookie("refreshToken", CLEAR_REFRESH_COOKIE_OPTIONS)
  await logAuthEvent(req, user._id, "CHANGE_PASSWORD", user._id)
  return success(res, null, "Password changed. Please log in again.")
})

module.exports = { login, refreshToken, logout, changePassword }
