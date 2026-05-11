const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const errorHandler = require('./middleware/error.middleware');

// Route imports
const authRoutes = require('./routes/auth.routes');
const startupRoutes = require('./routes/startup.routes');
const documentRoutes = require('./routes/document.routes');
const investorAccessRoutes = require('./routes/investorAccess.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

// --- Security & Utility Middleware ---

// Set security HTTP headers
app.use(helmet());

// Enable CORS (Whitelist client domain)
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true, // Allow cookies to be sent with requests
  })
);

// Global Rate Limiting (100 req per 15 min per IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many requests, please try again later.' },
});
app.use('/api', globalLimiter);

// Specific stricter limit for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Max 10 login/refresh attempts per IP
  message: { success: false, error: 'Too many auth attempts, please try again later.' },
});
app.use('/api/auth', authLimiter);

// Parse JSON bodies (limit 1mb)
app.use(express.json({ limit: '1mb' }));
// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
// Parse cookies (for refresh token)
app.use(cookieParser());

// Compress responses
app.use(compression());

// Logging
if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// --- Routes ---

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is healthy' });
});

app.use('/api/auth', authRoutes);
app.use('/api/startups', startupRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/access', investorAccessRoutes);
app.use('/api/admin', adminRoutes);

// --- Error Handling ---

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Central error handler (must be last)
app.use(errorHandler);

module.exports = app;
