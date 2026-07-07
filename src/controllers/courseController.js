const Course=require('../models/course');
const Institution=require('../models/institution');

// HELPER FUNCTION - RESOLVE TENANT ID FROM SUBDOMAIN
const resolveTenantFromSubdomain = async (req) => {
    const host = req.headers.host;
    if (!host) {
        return null;
    }
    
    const hostname = host.split(':')[0];
    if (!hostname) {
        return null;
    }

    // FOR THE DEVELOPMENT PHASE ONLY
   const subdomain = hostname.split('.')[0];
    if(subdomain === 'localhost'|| subdomain === '127.0.0.1'|| subdomain === 'www') {
        if(process.env.DEFAULT_TENANT_ID) {
            return process.env.DEFAULT_TENANT_ID;
        }
        return null;
    }

    const institution = await Institution.findOne({ subdomain }).select('_id');
    if(!institution) {
        return null;
    }
    return institution._id;
};

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

// GET ALL COURSES FOR THE CURRENT TENANT
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

        const course = await Course.findOne({ _id: req.params.id, tenantId: tenantId });
        if (!course) {
            return res.status(404).json({
                success : false,
                message : 'Course not found'
            });
        }

        const originalName = course.name;

        const { name, description, eligibilityCriteria, admissionCapacity, requiredDocuments, session } = req.body;

        if (name) course.name = name;
        if (description) course.description = description;
        if (eligibilityCriteria) course.eligibilityCriteria = eligibilityCriteria;
        if (admissionCapacity !== undefined) course.admissionCapacity = admissionCapacity;
        if (requiredDocuments) course.requiredDocuments = requiredDocuments;
        if (session) course.session = session;

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
