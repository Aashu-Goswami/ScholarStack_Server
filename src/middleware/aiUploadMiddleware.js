// AI AUTOFILL UPLOAD MIDDLEWARE
// CONFIGURES MULTER WITH MEMORY STORAGE FOR THE DOCUMENT-AUTOFILL ROUTE.
// Unlike fileUploadMiddleware.js (disk storage, used for the official
// document upload), this file is never written to disk — it only needs to
// exist in memory long enough to be base64-encoded and sent to the AI
// extraction service, then it's discarded.

const multer = require('multer');

const fileFilter = (req, file, cb) => {
    const allowedExtensions = /pdf|png|jpg|jpeg/;
    const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];

    const extOk = allowedExtensions.test(file.originalname);
    const mimeOk = allowedMimeTypes.includes(file.mimetype);
    const isOctetWithGoodExt = file.mimetype === 'application/octet-stream' && extOk;

    if (extOk && (mimeOk || isOctetWithGoodExt)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, PNG, JPG, and JPEG are allowed.'), false);
    }
};

const aiUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter,
});

module.exports = aiUpload;