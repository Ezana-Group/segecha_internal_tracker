const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

function isCloudinaryConfigured() {
    const k = process.env.CLOUDINARY_API_KEY || '';
    return !!(process.env.CLOUDINARY_CLOUD_NAME && k && k !== 'your_api_key');
}

const isMock = !isCloudinaryConfigured();

if (!isMock) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
}

// Upload a buffer (from multer memory storage) to Cloudinary
function uploadBuffer(buffer, folder, filename) {
    if (isMock) {
        console.log(`[MOCK CLOUDINARY] Uploading ${filename} to ${folder}...`);
        return Promise.resolve({
            secure_url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
            public_id: `mock/${folder}/${filename}`
        });
    }

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: `segecha/${folder}`,
                public_id: filename,
                resource_type: 'auto',
                transformation: [{ quality: 'auto:good', fetch_format: 'auto' }],
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        streamifier.createReadStream(buffer).pipe(stream);
    });
}

module.exports = { uploadBuffer, isCloudinaryConfigured };
