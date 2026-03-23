const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');

const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || 'dummy_key',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || 'dummy_secret',
    },
});

const BUCKET = process.env.R2_BUCKET_NAME || 'segecha-documents';
const PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

// Mock bypass for testing if credentials are missing
const isMock = !process.env.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID.includes('your_');

// Upload a buffer to R2
async function uploadToR2(buffer, key, contentType) {
    if (isMock) {
        console.log(`[MOCK R2] Uploading ${key}...`);
        return `https://dummyimage.com/600x400/000/fff&text=Mock+Document+${path.basename(key)}`;
    }

    await r2.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType || 'application/octet-stream',
        // Metadata stored alongside the file
        Metadata: {
            uploadedAt: new Date().toISOString(),
        },
    }));
    // Return the public URL
    return `${PUBLIC_URL}/${key}`;
}

// Delete a document from R2
async function deleteFromR2(key) {
    if (isMock) {
        console.log(`[MOCK R2] Deleting ${key}...`);
        return;
    }
    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

// Generate a signed URL for private access (if you turn off public access later)
async function getSignedDownloadUrl(key, expiresInSeconds = 3600) {
    if (isMock) return `https://dummyimage.com/600x400/000/fff&text=Mock+Signed+URL+${path.basename(key)}`;
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return getSignedUrl(r2, command, { expiresIn: expiresInSeconds });
}

// Build a structured key for a document
// e.g. trucks/T001/insurance/cert_2025.pdf
function buildKey(entityType, entityId, docType, filename) {
    const ext = path.extname(filename) || '.pdf';
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const ts = Date.now();
    return `${entityType}/${entityId}/${docType}/${ts}_${safe}`;
}

module.exports = { uploadToR2, deleteFromR2, getSignedDownloadUrl, buildKey };
