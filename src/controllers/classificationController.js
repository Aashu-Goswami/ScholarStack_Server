const Application = require('../models/application');
const ClassificationRule = require('../models/classificationRule');
const { classifyApplication } = require('../services/classificationEngine');

// GET CLASSIFICATION RULES FOR THE INSTITUTION
const getClassificationRules = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if(!tenantId) {
            return res.status(403).json({
                success : false,
                message : 'Admin does not belong to any institution'
            });
        }

        let rules = await ClassificationRule.findOne({ tenantId });
        if(!rules) {
            rules = {
                tenantId,
                highMeritThreshold : 85,
                mediumMeritThreshold : 60,
                reservedCategories : ['SC', 'ST', 'OBC', 'EWS'],
                eligibilityMinMarks : 50,
                courseSpecificRules : {}
            };
        }

        res.status(200).json({
            success : true,
            data : rules
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// UPDATE CLASSIFICATION RULES FOR THE INSTITUTION
const updateClassificationRules = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if(!tenantId) {
            return res.status(403).json({
                success : false,
                message : 'Admin does not belong to any institution'
            });
        }

        const {
            highMeritThreshold,
            mediumMeritThreshold,
            reservedCategories,
            eligibilityMinMarks,
            courseSpecificRules
        } = req.body;

        let rules = await ClassificationRule.findOne({ tenantId });
        if(!rules) {
            rules = new ClassificationRule({ tenantId });
        }

        if (highMeritThreshold !== undefined) rules.highMeritThreshold = highMeritThreshold;
        if (mediumMeritThreshold !== undefined) rules.mediumMeritThreshold = mediumMeritThreshold;
        if (reservedCategories) rules.reservedCategories = reservedCategories;
        if (eligibilityMinMarks !== undefined) rules.eligibilityMinMarks = eligibilityMinMarks;
        if (courseSpecificRules) rules.courseSpecificRules = courseSpecificRules;

        await rules.save();

        res.status(200).json({
            success : true,
            message : 'Classification rules updated successfully',
            data : rules
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// RUN CLASSIFICATION FOR A SINGLE APPLICATION
const classifySingleApplication = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if(!tenantId) {
            return res.status(403).json({
                success : false,
                message : 'Admin does not belong to any institution'
            });
        }

        const { applicationId } = req.params;

        const application = await Application.findOne({
            _id : applicationId,
            tenantId
        }).populate('courseId');

        if(!application) {
            return res.status(404).json({
                success : false,
                message : 'Application not found'
            });
        }

        const rules = await ClassificationRule.findOne({ tenantId }) || {};
        const classification = classifyApplication(application, rules);

        application.classification = classification;
        await application.save();

        res.status(200).json({
            success : true,
            message : 'Application classified successfully',
            data : {
                applicationId : application._id,
                classification
            }
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// RUN CLASSIFICATION FOR ALL APPLICATIONS IN THE INSTITUTION
const classifyAllApplications = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if(!tenantId) {
            return res.status(403).json({
                success : false,
                message : 'Admin does not belong to any institution'
            });
        }

        const applications = await Application.find({ tenantId })
            .populate('courseId')
            .populate('documents');

        if(applications.length === 0) {
            return res.status(200).json({
                success : true,
                message : 'No applications to classify',
                count : 0
            });
        }

        const rules = await ClassificationRule.findOne({ tenantId }) || {};

        const bulkOps = applications.map(app => {
            const classification = classifyApplication(app, rules);
            return {
                updateOne : {
                    filter : { _id : app._id },
                    update : { classification }
                }
            };
        });

        if(bulkOps.length > 0) {
            await Application.bulkWrite(bulkOps);
        }

        res.status(200).json({
            success : true,
            message : `Successfully classified ${applications.length} applications`,
            count : applications.length
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// GET ALL APPLICATIONS WITH THEIR CLASSIFICATION
const getClassifications = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if(!tenantId) {
            return res.status(403).json({
                success : false,
                message : 'Admin does not belong to any institution'
            });
        }

        const { course, status, category, meritLevel, page = 1, limit = 25 } = req.query;

        const filter = { tenantId };
        if(course) filter.courseId = course;
        if(status) filter.status = status;

        if(category) filter['classification.category'] = category;
        if(meritLevel) filter['classification.meritLevel'] = meritLevel;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const applications = await Application.find(filter)
            .populate('applicantId', 'name email')
            .populate('courseId', 'name session')
            .sort({ createdAt : -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Application.countDocuments(filter);

        res.status(200).json({
            success : true,
            count : applications.length,
            total,
            page : parseInt(page),
            pages : Math.ceil(total / parseInt(limit)),
            data : applications.map(app => ({
                applicationId : app._id,
                applicant : app.applicantId,
                course : app.courseId,
                status : app.status,
                classification : app.classification || {},
                submittedAt : app.submittedAt
            }))
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// GET CLASSIFICATION STATISTICS (COUNTS, BREAKDOWN) 
const getClassificationStats = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if(!tenantId) {
            return res.status(403).json({
                success : false,
                message : 'Admin does not belong to any institution'
            });
        }

        const stats = await Application.aggregate([
            { $match : { tenantId : tenantId } },
            {
                $group : {
                    _id : null,
                    totalApplications : { $sum : 1 },
                    eligible : { $sum : { $cond : [{ $eq : ['$classification.eligible', true] }, 1, 0] } },
                    notEligible : { $sum : { $cond : [{ $eq : ['$classification.eligible', false] }, 1, 0] } },
                    highMerit : { $sum : { $cond : [{ $eq : ['$classification.meritLevel', 'High Merit'] }, 1, 0] } },
                    mediumMerit : { $sum : { $cond : [{ $eq : ['$classification.meritLevel', 'Medium Merit'] }, 1, 0] } },
                    lowMerit : { $sum : { $cond : [{ $eq : ['$classification.meritLevel', 'Low Merit'] }, 1, 0] } },
                    reserved : { $sum : { $cond : [{ $eq : ['$classification.isReserved', true] }, 1, 0] } },
                    general : { $sum : { $cond : [{ $eq : ['$classification.isReserved', false] }, 1, 0] } },
                }
            }
        ]);

        const categoryStats = await Application.aggregate([
            { $match : { tenantId : tenantId } },
            { $group : { _id : '$classification.category', count : { $sum : 1 } } }
        ]);

        const courseMeritStats = await Application.aggregate([
            { $match : { tenantId : tenantId } },
            { $group : { _id : { course : '$courseId', merit : '$classification.meritLevel' }, count : { $sum : 1 } } }
        ]);

        res.status(200).json({
            success : true,
            data : {
                overall : stats[0] || {
                    totalApplications : 0,
                    eligible : 0,
                    notEligible : 0,
                    highMerit : 0,
                    mediumMerit : 0,
                    lowMerit : 0,
                    reserved : 0,
                    general : 0
                },
                categoryBreakdown : categoryStats,
                courseMeritBreakdown : courseMeritStats
            }
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// ADVANCED FILTERING BY CLASSIFICATION CRITERIA
const filterByClassification = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if(!tenantId) {
            return res.status(403).json({
                success : false,
                message : 'Admin does not belong to any institution'
            });
        }

        const {
            eligible, 
            meritLevel,
            category,
            isReserved,
            status,
            courseId,
            dateFrom,
            dateTo,
            page = 1,
            limit = 25
        } = req.query;

        const filter = { tenantId };

        if(eligible !== undefined) filter['classification.eligible'] = eligible === 'true';
        if(meritLevel) filter['classification.meritLevel'] = meritLevel;
        if(category) filter['classification.category'] = category;
        if(isReserved !== undefined) filter['classification.isReserved'] = isReserved === 'true;'
        if(status) filter.status = status;
        if(courseId) filter.courseId = courseId;
        if(dateFrom) filter.createdAt = { $gte : new Date(dateFrom) };
        if(dateTo) {
            if(!filter.createdAt) filter.createdAt = {};
            filter.createdAt.$lte = new Date(dateTo);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const applications = await Application.find(filter)
            .populate('applicantId', 'name email')
            .populate('courseId', 'name session')
            .sort({ createdAt : -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Application.countDocuments(filter);

        res.status(200).json({
            success : true,
            count : applications.length,
            total,
            page : parseInt(page),
            pages : Math.ceil(total / parseInt(limit)),
            data : applications
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// GET ALL APPLICATIONS BELONGING TO A SPECIFIC CLASSIFICATION
const getApplicationByClassification = async(req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if(!tenantId) {
            return res.status(403).json({
                success : false,
                message : 'Admin does not belong to any institution'
            });
        }
        
        const { classificationId } = req.params;

        const allowedMeritLevels = ['High Merit', 'Medium Merit', 'Low Merit'];
        let filter = { tenantId };

        if(allowedMeritLevels.includes(classificationId)) {
            filter['classification.meritLevel'] = classificationId;
        } else if(classificationId === 'Eligible' || classificationId === 'Not Eligible') {
            filter['classification.eligible'] = classificationId === 'Eligible';
        } else if(classificationId === 'Reserved' || classificationId === 'General') {
            filter['classification.isReserved'] = classificationId === 'Reserved';
        } else {
            filter['classification.category'] = classificationId;
        }

        const applications = await Application.find(filter)
            .populate('applicantId', 'name email')
            .populate('courseId', 'name session')
            .sort({ createdAt : -1 });

        res.status(200).json({
            success : true,
            count : applications.length,
            data : applications
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

module.exports = {
    getClassificationRules,
    updateClassificationRules,
    classifySingleApplication,
    classifyAllApplications,
    getClassifications,
    getClassificationStats,
    filterByClassification,
    getApplicationByClassification
};
