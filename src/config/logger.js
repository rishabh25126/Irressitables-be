const pino = require('pino');
const env = require('./env');
const logBuffer = require('../utils/logBuffer');

const usePretty =
  env.nodeEnv === 'development' || process.env.LOG_PRETTY === 'true';

const redact = {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers["x-api-key"]',
    'res.headers["set-cookie"]',
  ],
  censor: '[Redacted]',
};

let destination;
if (usePretty) {
  const pretty = require('pino-pretty')({ colorize: true });
  pretty.pipe(process.stdout);
  destination = pino.multistream([
    { stream: logBuffer.writable },
    { stream: pretty },
  ]);
} else {
  destination = pino.multistream([
    { stream: logBuffer.writable },
    { stream: process.stdout },
  ]);
}

const logger = pino(
  {
    level: env.logLevel,
    redact,
  },
  destination
);

module.exports = logger;
