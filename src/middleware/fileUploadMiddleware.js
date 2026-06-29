const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4 : uuidv4 } = require('uuid');

// Ensure directory exists
const uploadDir = path.join(__dirname,'../uploads/documents');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive : true });
}

// Storage engine configuration
const storage = multer.diskStorage({
    destination : (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename : (req, file, cb) => {
        // Create unique filename: fieldname-timestamp-random.ext
        const uniqueName = `${file.fieldname}-${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// File filter validation
const fileFilter = (req, file, cb) => {
    const allowedExtensions = /pdf|png|jpg|jpeg/;
    const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];

    const extName = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
    const mimeType = allowedMimeTypes.includes(file.mimetype);

    if(extName && mimeType) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, PNG, JPG, and JPEG are allowed.'), false);
    }
};

// Multer upload middleware configuration
const upload = multer({
    storage : storage,
    limits : { fileSize : 5 * 1024 * 1024 },
    fileFilter : fileFilter
});

module.exports = upload;
