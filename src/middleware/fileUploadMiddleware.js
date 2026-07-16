// FILE UPLOAD MIDDLEWARE
// CONFIGURES MULTER FOR HANDLING DOCUMENT UPLOADS
// USAGE - ADD 'upload.single('file')' TO ROUTES THAT ACCEPT FILE UPLOADS

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4 : uuidv4 } = require('uuid');

// UPLOAD DIRECTORY PATH FOR DOCUMENTS - FILES STORED IN src/uploads/documents
const uploadDir = path.join(__dirname,'../uploads/documents');

// ENSURE UPLOAD DIRECTORY EXISTS - CREATES IT RECURSIVELY IF NOT EXIST
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive : true });
}

// MULTER DISK STORAGE CONFIGURATION 
const storage = multer.diskStorage({
    
    // DESTINATION FOLDER FOR UPLOADED FILES
    destination : (req, file, cb) => {
        cb(null, uploadDir);
    },

    // GENERATE A UNIQUE FILENAME USING UUID FOR UPLOADED FILES
    filename : (req, file, cb) => {
        const uniqueName = `${file.fieldname}-${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// FILE FILTER - VALIDATES UPLOADED FILES BEFORE THEY ARE SAVED 
const fileFilter = (req, file, cb) => {

    // ALLOWED FILE EXTENSIONS AND MIME TYPES
    const allowedExtensions = /pdf|png|jpg|jpeg/;
    const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];

    // VALIDATE EXTENSION, MIME TYPE 
    const extOk = allowedExtensions.test(file.originalname);
    const mimeOk = allowedMimeTypes.includes(file.mimetype);
    const isOctetWithGoodExt = file.mimetype === 'application/octet-stream' && extOk;

    // ACCEPT FILE IF EXTENSION AND MIME ARE OK
    if(extOk && (mimeOk || isOctetWithGoodExt)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, PNG, JPG, and JPEG are allowed.'), false);
    }
};

// MULTER UPLOAD MIDDLEWARE CONFIGURATION
const upload = multer({
    storage : storage,
    limits : { fileSize : 5 * 1024 * 1024 },
    fileFilter : fileFilter
});

module.exports = upload;
