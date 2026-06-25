const Institution = require('../models/institution');
const User = require('../models/user');

// GET ALL INSTITUTIONS FUNCTION
const getInstitutions = async (req, res) => {
    try {
        const institutions = await Institution.find().sort({ createdAt: -1 });
        
        res.status(200).json({
            success : true,
            count : institutions.length,
            data : institutions
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// GET SINGLE INSTITUTION BY ID FUNCTION
const getInstitutionById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        // FETCH INSTITUTION
        const institution = await Institution.findById(id);
        if(!institution) {
            return res.status(404).json({
                success : false,
                message : 'Institution not found'
            });
        }

        // PERMISSON CHECK - SUPER ADMIN ALLOWED, INSITUTION ADMIN ONLY IF TENANT ID MATCHES
        if(user.role === 'instAdmin' && user.tenantId.toString() !== id) {
            return res.status(403).json({
                success : false,
                message : 'Access denied. You can view only your own institution'
            });
        }

        res.status(200).json({
            success : true,
            data : institution
        });
    } catch (err) {
        res.status(404).json({
            success : false,
            message : err.message
        });
    }
};

// CREATE A NEW INSTITUTION - ONLY SUPER ADMIN
const createInstitution = async (req, res) => {
    try {
        // GET REQUIRED FIELDS FROM REQUEST
        const { name, subdomain, logo, contactEmail, contactPhone, address, website, admissionSession } = req.body;

        // BASIC VALIDATION
        if(!name || !subdomain) {
            return res.status(400).json({
                success : false,
                message : 'Please provide institution name and subdomain'
            });
        }

        // CHECK IF SUBDOMAIN ALREADY EXISTS
        const existing = await Institution.findOne({ subdomain });
        if(existing) {
            return res.status(400).json({
                success : false,
                message : 'Institution with this subdomain already exists'
            });
        }

        // CREATE NEW INSTITUTION
        const institution = await Institution.create({
            name,
            subdomain : subdomain.toLowerCase(),
            logo : logo || '',
            contactEmail : contactEmail || '',
            contactPhone : contactPhone || '',
            address : address || '',
            website : website || '',
            admissionSession : admissionSession || ''
        });

        res.status(201).json({
            success : true,
            message : 'Institution created successfully',
            data: institution
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// UPDATE INSTITUTION DETAILS - SUPER ADMIN OR INSTITUTION ADMIN (ONLY THEIR OWN)
const updateInstitution = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        // FIND INSTITUTION
        const institution = await Institution.findById(id);
        if(!institution) {
            return res.status(404).json({
                success : false,
                message : 'Institution not found'
            });
        }

        // PERMISSION CHECK 
        if(user.role === 'instAdmin' && user.tenantId.toString() !== id) {
            return res.status(403).json({
                success : false,
                message : 'Access denied. You can only update your own institution'
            });
        }
        
        // UPDATE ALLOWED FIELDS ONLY
        const { name, logo, contactEmail, contactPhone, address, website, admissionSession } = req.body;

        if(name) institution.name = name;
        if(logo) institution.logo = logo;
        if(contactEmail) institution.contactEmail = contactEmail;
        if(contactPhone) institution.contactPhone = contactPhone;
        if(address) institution.address = address;
        if(website) institution.website = website;
        if(admissionSession) institution.admissionSession = admissionSession;

        await institution.save();

        res.status(200).json({
            success : true,
            message : 'Institution updated successfully',
            data : institution
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// DELETE INSTITUTION - ONLY SUPER ADMIN
const deleteInstitution = async (req, res) => {
    try {
        const institution = await Institution.findById(req.params.id);
        if(!institution) {
            return res.status(404).json({
                success : false,
                message : 'Institution not found'
            });
        }

        await institution.deleteOne();

        res.status(200).json({
            success : true,
            message : 'Institution deleted successfully'
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

module.exports = {
    getInstitutions,
    getInstitutionById,
    createInstitution,
    updateInstitution,
    deleteInstitution
};
