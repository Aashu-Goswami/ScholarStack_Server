// THIS MODULE HANDLES CRUD OPERATIONS FOR COURSES WITHIN AN INSTITUTION

const Course = require('../models/course');
const { resolveTenantFromSubdomain } = require('../middleware/tenantResolverMiddleware');

// CREATE A NEW COURSE - ONLY INSTITUTION ADMIN
const createCourse = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({
                success : false,
                message : 'Admin does not belong to any institution'
            });
        }

        const {name, eligibilityCriteria, admissionCapacity, requiredDocuments, session, description } = req.body;

        // VALIDATE REQUIRED FIELDS 
        if (!name) {
            return res.status(400).json({
                success : false,
                message : 'Please provide course name'
            });
        }

        // CHECK IF COURSE ALREADY EXISTS UNDER THIS TENANT
        const existingCourse = await Course.findOne({ name, tenantId });
        if (existingCourse) {
            return res.status(400).json({
                success : false,
                message : 'Course with this name already exists for your institution'
            });
        }

        // CREATE NEW COURSE
        const course = await Course.create({
            name,
            description : description || '',
            tenantId,
            eligibilityCriteria : eligibilityCriteria || {},
            admissionCapacity : admissionCapacity || 0,
            requiredDocuments : requiredDocuments || [],
            session : session || '',
            createdBy : req.user.id
        });

        res.status(201).json({
            success : true,
            message : 'Course created successfully',
            data : course
        });
    } catch (err){
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// GET ALL COURSES FOR THE CURRENT INSTITUTION
const getCourses = async (req, res) => {
    try {
        const tenantId = await resolveTenantFromSubdomain(req);
        if (!tenantId) {
            return res.status(400).json({
                success : false,
                message : 'Invalid institution subdomain'
            });
        }

        const courses = await Course.find({ tenantId }).sort({ createdAt: -1 });

        res.status(200).json({
            success : true,
            count : courses.length,
            data : courses
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// GET SINGLE COURSE BY ID - WITHIN TENANT
const getCourseById = async (req, res) => {
    try {
        const tenantId = await resolveTenantFromSubdomain(req);
        if (!tenantId) {
            return res.status(400).json({
                success : false,
                message : 'Invalid Institution subdomain'
            });
        }

        const course = await Course.findOne({ _id: req.params.id, tenantId: tenantId });
        if (!course) {
            return res.status(404).json({
                success : false,
                message : 'Course not found'
            });
        }

        res.status(200).json({
            success : true,
            data : course
        });
    } catch (err) {
         if (err.name === 'CastError' || err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// UPDATE COURSE - ONLY INSTITUTION ADMIN, WITHIN TENANT
const updateCourse = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({
                success : false,
                message : 'Admin does not belong to any institution'
            });
        }

        // FIND COURSE - MUST BELONG TO THIS TENANT
        const course = await Course.findOne({ _id: req.params.id, tenantId: tenantId });
        if (!course) {
            return res.status(404).json({
                success : false,
                message : 'Course not found'
            });
        }

        // STORE ORIGINAL NAME BEFORE ANY MODIFICATIONS
        const originalName = course.name;

        // EXTRACT UPDATABLE FIELDS
        const { name, description, eligibilityCriteria, admissionCapacity, requiredDocuments, session, isActive } = req.body;

        // UPDATE PROVIDED FIELDS
        if (name) course.name = name;
        if (description) course.description = description;
        if (eligibilityCriteria) course.eligibilityCriteria = eligibilityCriteria;
        if (admissionCapacity !== undefined) course.admissionCapacity = admissionCapacity;
        if (requiredDocuments) course.requiredDocuments = requiredDocuments;
        if (session) course.session = session;
        if (isActive !== undefined) course.isActive = isActive;

        // CHECK UNIQUENESS IF NAME IS BEING CHANGED
        if(name && name !== originalName) {
            const existing = await Course.findOne({ name, tenantId });
            if(existing) {
                return res.status(400).json({
                    success : false,
                    message : 'Another course with same name already exists'
                });
            }
        }

        await course.save();

        res.status(200).json({
            success : true,
            message : 'Course updated successfully',
            data : course
        });
    } catch (err) {
        if (err.name === 'CastError' || err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// DELETE COURSE - ONLY INSTITUTION ADMIN, WITHIN TENANT
const deleteCourse = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({
                success : false,
                message : 'Admin does not belong to any institution'
            });
        }

        // FIND AND DELETE COURSE
        const course = await Course.findOneAndDelete({ _id: req.params.id, tenantId: tenantId });
        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Course deleted successfully'
        });
    } catch (err) {
        if (err.name === 'CastError' || err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

module.exports = {
    createCourse,
    getCourses,
    getCourseById,
    updateCourse,
    deleteCourse
};
