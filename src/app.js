const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const pinoHttp = require('pino-http');
const stdSerializers = require('pino-std-serializers');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const logger = require('./config/logger');
const requestId = require('./middleware/requestId.middleware');
const errorHandler = require('./middleware/error.middleware');

// Route imports
const authRoutes = require('./routes/auth.routes');
const startupRoutes = require('./routes/startup.routes');
const documentRoutes = require('./routes/document.routes');
const investorAccessRoutes = require('./routes/investorAccess.routes');
const requestRoutes = require('./routes/request.routes');
const adminRoutes = require('./routes/admin.routes');
const logsRoutes = require('./routes/logs.routes');

const app = express();

// Vercel and other reverse proxies: correct client IP for rate limiting
if (process.env.VERCEL) {
  app.set('trust proxy', 1);
}

// --- Security & Utility Middleware ---

// Set security HTTP headers
app.use(helmet());

app.use(requestId);

app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.id,
    serializers: {
      req: (req) => {
        const serialized = stdSerializers.req(req);
        if (serialized.headers) {
          if (serialized.headers.authorization) {
            serialized.headers.authorization = '[Redacted]';
          }
          if (serialized.headers.cookie) {
            serialized.headers.cookie = '[Redacted]';
          }
        }
        return serialized;
      },
    },
    autoLogging: {
      ignore: (req) => {
        const path = (req.originalUrl || req.url || '').split('?')[0];
        if (path === '/api/health') return true;
        if (path === '/logs' || path === '/api/logs') return true;
        return false;
      },
    },
  })
);

// CORS: default allows any browser Origin (reflect Origin header; works with credentials)
app.use(
  cors({
    origin: env.corsAllowAnyOrigin
      ? true
      : (origin, cb) => {
          if (!origin) {
            return cb(null, true);
          }
          if (env.corsAllowedOrigins.includes(origin)) {
            return cb(null, true);
          }
          return cb(null, false);
        },
    credentials: true,
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

// --- Routes ---

if (env.enableDebugLogsRoute) {
  app.use('/logs', logsRoutes);
  app.use('/api/logs', logsRoutes);
}

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is healthy' });
});

app.use('/api/auth', authRoutes);
app.use('/api/startups', startupRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/access', investorAccessRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/admin', adminRoutes);

// --- Error Handling ---

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Central error handler (must be last)
app.use(errorHandler);

module.exports = app;
