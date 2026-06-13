// controllers/courseController.js
const Course = require('../models/course');

// CREATE A NEW COURSE - ONLY INSTITUTION ADMIN
const createCourse = async (req, res) => {
    try {
        // GET TENANT ID FROM AUTHENTICATED USER
        const tenantId = req.user.tenantId;

        const { name, eligibilityCriteria, capacity, requiredDocuments } = req.body;

        if(!name) {
            return res.status(400).json({
                success : false,
                message : 'Please provide course name'
            });
        }

        // CHECK IF COURSE ALREADY EXISTS UNDER THIS TENANT
        const existing = await Course.findOne({ name, tenantId });
        if(existing) {
            return res.status(400).json({
                success : false,
                message : 'Course with this name already exists for your institution'
            });
        }

        // CREATE NEW COURSE
        const course = await Course.create({
            name,
            tenantId,
            eligibilityCriteria,
            capacity,
            requiredDocuments
        });

        res.status(201).json({
            success : true,
            message : 'Course created successfully',
            course
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// GET ALL COURSES FOR THE CURRENT TENANT
const getCourses = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;

        const courses = await Course.find({ tenantId });

        res.status(200).json({
            success : true,
            count : courses.length,
            courses
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
        const tenantId = req.user.tenantId;

        const course = await Course.findOne({ _id : req.params.id, tenantId });

        if(!course) {
            return res.status(404).json({
                success : false,
                message : 'Course not found'
            });
        }

        res.status(200).json({
            success : true,
            course
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

        const course = await Course.findOne({ _id : req.params.id, tenantId });

        if(!course) {
            return res.status(404).json({
                success : false,
                message : 'Course not found'
            });
        }

        // UPDATE ALLOWED FIELDS ONLY
        const { name, eligibilityCriteria, capacity, requiredDocuments } = req.body;

        if(name) course.name = name;
        if(eligibilityCriteria) course.eligibilityCriteria = eligibilityCriteria;
        if(capacity) course.capacity = capacity;
        if(requiredDocuments) course.requiredDocuments = requiredDocuments;

        await course.save();

        res.status(200).json({
            success : true,
            message : 'Course updated successfully',
            course
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

        const course = await Course.findOne({ _id : req.params.id, tenantId });

        if(!course) {
            return res.status(404).json({
                success : false,
                message : 'Course not found'
            });
        }

        await course.deleteOne();

        res.status(200).json({
            success : true,
            message : 'Course deleted successfully'
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
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