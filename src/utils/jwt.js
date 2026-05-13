const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Signs a short-lived access token (15 min default).
 * @param {Object} payload - { id, role }
 */
const signAccessToken = (payload) => {
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpires,
  });
};

/**
 * Signs a long-lived refresh token (5 days default).
 * @param {Object} payload - { id }
 */
const signRefreshToken = (payload) => {
  return jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpires,
  });
};

/**
 * Verifies a token and returns the decoded payload.
 * Throws a JsonWebTokenError if invalid or expired.
 * @param {string} token
 * @param {'access'|'refresh'} type
 */
const verifyToken = (token, type = 'access') => {
  const secret = type === 'access' ? env.jwt.accessSecret : env.jwt.refreshSecret;
  return jwt.verify(token, secret);
};

module.exports = { signAccessToken, signRefreshToken, verifyToken };
