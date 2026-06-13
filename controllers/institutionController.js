// controllers/institutionController.js
const Institution = require('../models/institution');

// CREATE A NEW INSTITUTION - ONLY SUPER ADMIN
const createInstitution = async (req, res) => {
    try {
        // GET REQUIRED FIELDS FROM REQUEST
        const { name, subdomain, logo, contactInfo, address, website, admissionSession } = req.body;

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
            subdomain,
            logo,
            contactInfo,
            address,
            website,
            admissionSession
        });

        res.status(201).json({
            success : true,
            message : 'Institution created successfully',
            institution
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// GET INSTITUTION DETAILS BY ID
const getInstitution = async (req, res) => {
    try {
        const institution = await Institution.findById(req.params.id);

        if(!institution) {
            return res.status(404).json({
                success : false,
                message : 'Institution not found'
            });
        }

        res.status(200).json({
            success : true,
            institution
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// UPDATE INSTITUTION DETAILS - ONLY SUPER ADMIN
const updateInstitution = async (req, res) => {
    try {
        const institution = await Institution.findById(req.params.id);

        if(!institution) {
            return res.status(404).json({
                success : false,
                message : 'Institution not found'
            });
        }

        // UPDATE ALLOWED FIELDS ONLY
        const { name, logo, contactInfo, address, website, admissionSession } = req.body;

        if(name) institution.name = name;
        if(logo) institution.logo = logo;
        if(contactInfo) institution.contactInfo = contactInfo;
        if(address) institution.address = address;
        if(website) institution.website = website;
        if(admissionSession) institution.admissionSession = admissionSession;

        await institution.save();

        res.status(200).json({
            success : true,
            message : 'Institution updated successfully',
            institution
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
    createInstitution,
    getInstitution,
    updateInstitution,
    deleteInstitution
};