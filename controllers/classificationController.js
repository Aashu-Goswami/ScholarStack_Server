const Application = require('../models/application');
const { classifyApplication } = require('../services/classificationEngine');

// GET SINGLE APPLICATION CLASSIFICATION - APPLICANT OR ADMIN (WITHIN TENANT)
const getClassificationByApplicationId = async (req, res) => {
    try {
        const tenantId = req.user.tenantId; // resolved from auth token
        const filter = { _id: req.params.id };

        // Non-admins can only check their own classification details
        if (req.user.role !== 'instAdmin' && req.user.role !== 'superAdmin') {
            filter.applicantId = req.user.id;
        } else if (tenantId) {
            filter.tenantId = tenantId;
        }

        const application = await Application.findOne(filter)
            .populate('courseId')
            .populate('documents');

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        const tags = classifyApplication(application);

        res.status(200).json({
            success: true,
            data: {
                applicationId: application._id,
                status: application.status,
                category: application.personalDetails
                    ? application.personalDetails.category
                    : 'General',
                academicMarks: application.personalDetails
                    ? application.personalDetails.academicMarks
                    : 0,
                classificationTags: tags
            }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// BULK CLASSIFICATION REPORT - ADMIN ONLY
const bulkClassifyApplications = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Admin does not belong to any institution'
            });
        }

        const applications = await Application.find({ tenantId })
            .populate('courseId')
            .populate('applicantId', 'name email')
            .populate('documents');

        const classifiedReports = applications.map(app => {
            const tags = classifyApplication(app);
            return {
                applicationId: app._id,
                applicantName: app.applicantId
                    ? app.applicantId.name
                    : 'Unknown',
                courseName: app.courseId
                    ? app.courseId.name
                    : 'Unknown',
                status: app.status,
                classificationTags: tags
            };
        });

        res.status(200).json({
            success: true,
            count: classifiedReports.length,
            data: classifiedReports
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

module.exports = {
    getClassificationByApplicationId,
    bulkClassifyApplications
};
