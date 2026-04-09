const path = require('path');
const crypto = require('crypto');
const { uploadBuffer, isCloudinaryConfigured } = require('./cloudinary');
const { uploadToR2, buildKey, isR2Configured } = require('./r2');

const IMAGE_MIME = /^image\//i;

/**
 * Persist an uploaded file: images → Cloudinary (preferred), non-images → Cloudflare R2.
 * Falls back to data URLs when credentials are not configured (local dev).
 *
 * @param {Express.Multer.File} file
 * @param {{ entityType?: string, entityId?: string, docType?: string, cloudinaryFolder?: string }} opts
 */
async function persistUploadedFile(file, opts = {}) {
    if (!file?.buffer?.length) return '';
    const mime = file.mimetype || 'application/octet-stream';
    const original = file.originalname || 'file';
    const buf = file.buffer;

    const entityType = opts.entityType || 'general';
    const entityId = opts.entityId || 'uploads';
    const docType = (opts.docType || 'files').replace(/[^a-zA-Z0-9._-]/g, '_');

    if (IMAGE_MIME.test(mime)) {
        if (isCloudinaryConfigured()) {
            try {
                const base = path.basename(original, path.extname(original)).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'img';
                const publicId = `${base}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
                const folder = opts.cloudinaryFolder || 'tracker';
                const result = await uploadBuffer(buf, folder, publicId);
                return result.secure_url;
            } catch (e) {
                console.warn('[persistUpload] Cloudinary failed, trying Cloudflare R2:', e.message);
            }
        }
        if (isR2Configured()) {
            try {
                const key = buildKey(entityType, entityId, docType || 'photos', original);
                return await uploadToR2(buf, key, mime);
            } catch (e) {
                console.warn('[persistUpload] R2 image upload failed:', e.message);
            }
        }
    } else if (isR2Configured()) {
        try {
            const key = buildKey(entityType, entityId, docType, original);
            return await uploadToR2(buf, key, mime);
        } catch (e) {
            console.warn('[persistUpload] R2 file upload failed:', e.message);
        }
    }

    return `data:${mime};base64,${buf.toString('base64')}`;
}

module.exports = { persistUploadedFile };
