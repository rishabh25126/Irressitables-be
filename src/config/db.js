const mongoose = require("mongoose")
const env = require("./env")
const logger = require("./logger")

function isServerlessRuntime() {
  return !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
}

// Always off: avoids 10s "buffering timed out" when the socket never becomes ready (Vercel + Atlas).
mongoose.set("bufferCommands", false)

function defaultRetryCount() {
  return isServerlessRuntime() ? 1 : 5
}

function retryDelayMs() {
  return isServerlessRuntime() ? 1000 : 3000
}

/** One in-flight connect across concurrent invocations (serverless). */
let connectMutex = null

/**
 * Connects to MongoDB with retry logic.
 * Reuses an existing connection (important for Vercel serverless).
 * On long-running Node (server.js), exits after exhausting retries.
 */
const connectDB = async (retriesLeft = defaultRetryCount()) => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection
  }

  if (mongoose.connection.readyState === 2) {
    await mongoose.connection.asPromise()
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection
    }
  }

  if (connectMutex) {
    await connectMutex
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection
    }
    throw new Error(
      `MongoDB not connected after wait (readyState=${mongoose.connection.readyState})`
    )
  }

  connectMutex = (async () => {
    const serverSelectionTimeoutMS = isServerlessRuntime() ? 10000 : 5000
    const options = {
      serverSelectionTimeoutMS,
      maxPoolSize: isServerlessRuntime() ? 5 : 10,
      minPoolSize: 0,
      family: 4,
    }

    let attempts = retriesLeft
    while (attempts >= 0) {
      try {
        await mongoose.connect(env.mongoUri, options)
        if (mongoose.connection.readyState !== 1) {
          throw new Error(
            `Mongo readyState ${mongoose.connection.readyState} after connect()`
          )
        }
        logger.info({ host: mongoose.connection.host }, "MongoDB connected")
        return mongoose.connection
      } catch (error) {
        if (attempts > 0) {
          logger.warn(
            { err: error, retriesLeft: attempts - 1 },
            "MongoDB connection failed; retrying"
          )
          await new Promise((res) => setTimeout(res, retryDelayMs()))
          attempts -= 1
          continue
        }
        logger.error(
          { err: error },
          "MongoDB connection failed after all retries."
        )
        if (isServerlessRuntime()) {
          throw error
        }
        process.exit(1)
      }
    }
  })().finally(() => {
    connectMutex = null
  })

  await connectMutex
  return mongoose.connection
}

module.exports = connectDB
