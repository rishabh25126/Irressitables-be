const { Writable } = require('stream');

const rawMax = parseInt(process.env.LOG_BUFFER_MAX_LINES || '500', 10);
const MAX_LINES = Math.min(Math.max(Number.isFinite(rawMax) ? rawMax : 500, 50), 10_000);

const lines = [];

function push(line) {
  lines.push(line);
  if (lines.length > MAX_LINES) {
    lines.splice(0, lines.length - MAX_LINES);
  }
}

function getLines() {
  return [...lines];
}

/** Writable stream sink for Pino multistream (NDJSON lines). */
const writable = new Writable({
  write(chunk, enc, cb) {
    chunk
      .toString()
      .split('\n')
      .map((l) => l.trimEnd())
      .filter(Boolean)
      .forEach((line) => push(line));
    cb();
  },
});

module.exports = {
  push,
  getLines,
  writable,
  MAX_LINES,
};
