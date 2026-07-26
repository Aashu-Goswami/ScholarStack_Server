// THIS MODULE HANDLES CRUD OPERATIONS FOR INSTITUION 
// INSTITUTION ADMIN CAN MANAGE : NAME, LOGO, CONTACT INFO, ADDRESS, WEBSITE, ADMISSION SESIION
// SUPER ADMIN CAN CREATE AND MANAGE INSTITUTION

const Institution = require('../models/institution');

// GET INSTITUIONS FOR LANDING PAGE - NO AUTHENTICATION
const getPublicInstitutions = async (req, res) => {
  try {
    const totalCount = await Institution.countDocuments({ isActive: true });

    const institutions = await Institution.find({ isActive: true })
      .select('name address logo')
      .limit(8)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: institutions,
      totalCount,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

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

// GET A SINGLE INSTITUTION BY ID FUNCTION
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

        // PERMISSION CHECK - SUPER ADMIN ALLOWED, INSTITUTION ADMIN ONLY IF TENANT ID MATCHES
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
        if (err.name === 'CastError' || err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Institution not found'
            });
        }
        res.status(500).json({
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

        // VALIDATE REQUIRED FIELDS
        if(!name || !subdomain) {
            return res.status(400).json({
                success : false,
                message : 'Please provide institution name and subdomain'
            });
        }

        // VALIDATE SUBDOMAIN FORMAT
        const isValidSubdomain = (subdomain) => { return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(subdomain); };
        const normalizedSubdomain = subdomain.toLowerCase().trim();
        if (!isValidSubdomain(normalizedSubdomain)) {
            return res.status(400).json({
                success: false,
                message: 'Subdomain can only contain lowercase letters, numbers, and hyphens'
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
            name : name.trim(),
            subdomain : normalizedSubdomain,
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

        if(name) institution.name = name.trim();
        if(logo) institution.logo = logo;
        if(contactEmail) institution.contactEmail = contactEmail.trim();
        if(contactPhone) institution.contactPhone = contactPhone.trim();
        if(address) institution.address = address.trim();
        if(website) institution.website = website.trim();
        if(admissionSession) institution.admissionSession = admissionSession.trim();

        await institution.save();

        res.status(200).json({
            success : true,
            message : 'Institution updated successfully',
            data : institution
        });
    } catch (err) {
        if (err.name === 'CastError' || err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Institution not found'
            });
        }
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
    getPublicInstitutions,
    getInstitutions,
    getInstitutionById,
    createInstitution,
    updateInstitution,
    deleteInstitution
};
