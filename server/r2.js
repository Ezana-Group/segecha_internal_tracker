const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');

const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const BUCKET = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

function isR2Configured() {
    const k = process.env.R2_ACCESS_KEY_ID || '';
    return !!(process.env.CF_ACCOUNT_ID && k && !k.includes('your_') && BUCKET && PUBLIC_URL);
}

// Mock bypass for testing if credentials are missing
const isMock = !isR2Configured();

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

const BACKUPS_PREFIX = 'backups/';

function safeBackupFilename(filename) {
    const base = path.basename(filename);
    if (!/^[\w.\-]+\.json$/i.test(base)) throw new Error('Invalid backup filename');
    return base;
}

/** Upload JSON backup to R2 under backups/ (offsite mirror). */
async function uploadBackupToR2(filename, jsonStringOrBuffer) {
    if (!isR2Configured()) return { ok: false, skipped: true };
    const base = safeBackupFilename(filename);
    const key = `${BACKUPS_PREFIX}${base}`;
    const buf = Buffer.isBuffer(jsonStringOrBuffer)
        ? jsonStringOrBuffer
        : Buffer.from(jsonStringOrBuffer, 'utf8');
    const url = await uploadToR2(buf, key, 'application/json');
    return { ok: true, key, url };
}

/** List .json objects under backups/ */
async function listR2Backups() {
    if (isMock) return [];
    const out = await r2.send(new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: BACKUPS_PREFIX,
    }));
    const contents = out.Contents || [];
    return contents
        .filter((o) => o.Key && o.Key.endsWith('.json'))
        .map((o) => ({
            name: o.Key.slice(BACKUPS_PREFIX.length),
            timestamp: o.LastModified,
            size: o.Size,
        }));
}

/** Read backup object body (full key e.g. backups/file.json) */
async function getR2ObjectBuffer(key) {
    if (isMock) throw new Error('R2 not configured');
    const out = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const chunks = [];
    for await (const chunk of out.Body) chunks.push(chunk);
    return Buffer.concat(chunks);
}

module.exports = {
    uploadToR2,
    deleteFromR2,
    getSignedDownloadUrl,
    buildKey,
    isR2Configured,
    uploadBackupToR2,
    listR2Backups,
    getR2ObjectBuffer,
    BACKUPS_PREFIX,
};
