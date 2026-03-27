const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

const isMock = process.env.CLOUDINARY_API_KEY === 'your_api_key' || !process.env.CLOUDINARY_CLOUD_NAME && !process.env.CLOUDINARY_URL;

if (!isMock) {
    if (process.env.CLOUDINARY_URL) {
        // Automatically picks up from process.env.CLOUDINARY_URL
        cloudinary.config(true);
    } else {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });
    }
    cloudinary.config();
}

// Upload a buffer (from multer memory storage) to Cloudinary
function uploadBuffer(buffer, folder, filename) {
    if (isMock) {
        console.log(`[MOCK CLOUDINARY] Uploading ${filename || 'random'} to ${folder}...`);
        return Promise.resolve({
            secure_url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
            public_id: `mock/${folder}/${filename || Date.now()}`
        });
    }

    if (!cloudinary.config().cloud_name) {
        return Promise.reject(new Error('Cloudinary is not configured on the server.'));
    }

    return new Promise((resolve, reject) => {
        const public_id = filename ? filename.replace(/[^a-zA-Z0-9._-]/g, '_') : `img_${Date.now()}`;
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: `segecha/${folder}`,
                public_id: public_id,
                resource_type: 'auto',
                transformation: [{ quality: 'auto:good', fetch_format: 'auto' }],
            },
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            }
        );
        streamifier.createReadStream(buffer).pipe(stream);
    });
}

module.exports = { uploadBuffer };
