const express = require("express")
const logBuffer = require("../utils/logBuffer")
const env = require("../config/env")

const router = express.Router()

function guard(req, res, next) {
  if (!env.logsRouteSecret) {
    return next()
  }
  if (req.get("x-logs-secret") !== env.logsRouteSecret) {
    return res.status(401).json({ success: false, error: "Unauthorized" })
  }
  return next()
}

router.get("/", guard, (req, res) => {
  const buf = logBuffer.getLines()
  if (req.query.format === "json") {
    const logs = buf.map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return { _raw: line }
      }
    })
    return res.json({
      success: true,
      count: logs.length,
      maxLines: logBuffer.MAX_LINES,
      logs,
    })
  }
  res.type("text/plain; charset=utf-8").send(buf.join("\n"))
})

module.exports = router
