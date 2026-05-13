const {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3")
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner")
const { Upload } = require("@aws-sdk/lib-storage")
const env = require("../config/env")

// Initialize S3 client once, reuse across the app
const s3Client = new S3Client({
  region: env.aws.region,
  credentials: {
    accessKeyId: env.aws.accessKeyId,
    secretAccessKey: env.aws.secretAccessKey,
  },
})

/**
 * Uploads a file buffer to S3.
 * @param {Object} options
 * @param {Buffer} options.buffer - File content
 * @param {string} options.key - S3 object key (e.g. "documents/business-id/filename.pdf")
 * @param {string} options.mimeType - MIME type of the file
 * @returns {Promise<string>} The S3 object key (store this in DB, not the full URL)
 */
const uploadToS3 = async ({ buffer, key, mimeType }) => {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: env.aws.bucketName,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      // No ACL — bucket is private, access via signed URLs only
    },
  })

  await upload.done()
  return key
}

/**
 * Generates a pre-signed URL for a private S3 object.
 * Valid for 15 minutes by default.
 * @param {string} key - S3 object key
 * @param {number} expiresInSeconds - URL validity duration
 * @returns {Promise<string>} Pre-signed download URL
 */
const getPresignedUrl = async (key, expiresInSeconds = 900) => {
  const command = new GetObjectCommand({
    Bucket: env.aws.bucketName,
    Key: key,
  })

  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds })
}

/**
 * Permanently deletes an object from S3.
 * @param {string} key - S3 object key to delete
 */
const deleteFromS3 = async (key) => {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: env.aws.bucketName,
      Key: key,
    })
  )
}

module.exports = { uploadToS3, getPresignedUrl, deleteFromS3 }
