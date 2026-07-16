// THIS MODULE HANDLES DASHBOARD IMPLEMENTATION
 
const Application = require('../models/application');
const Course = require('../models/course');
const Document = require('../models/document');
const mongoose = require('mongoose');

// GET ADMIN DASHBOARD SUMMARY METRICS 
const getAdminDashboard = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Admin does not belong to any institution'
            });
        }

        // COUNT APPLICATIONS GROUPED BY STATUS USING AGGREGRATION
        const counts = await Application.aggregate([
            { $match: { tenantId: new mongoose.Types.ObjectId(tenantId) } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // INITIALIZE ALL STATUS COUNTS
        const statusCounts = {
            draft: 0,
            submitted: 0,
            under_review: 0,
            verified: 0,
            admitted: 0,
            rejected: 0
        };

        let total = 0;
        counts.forEach(item => {
            if (statusCounts[item._id] !== undefined) {
                statusCounts[item._id] = item.count;
            }
            total += item.count;
        });

        // COMPUTE SUMMARY AGGREGRATES WITH CLEAR NAMING
        const pending = statusCounts.draft + statusCounts.submitted + statusCounts.under_review;
        const approved = statusCounts.admitted;
        const rejected = statusCounts.rejected;
        const verified = statusCounts.verified;

        // COMPUTE CONVERSION AND REJECTION RATES
        const conversionRate = total > 0 ? ((approved / total) * 100).toFixed(2) : "0.00";
        const rejectionRate = total > 0 ? ((rejected / total) * 100).toFixed(2) : "0.00";

        res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalApplications: total,         
                    pendingApplications: pending,     
                    approvedApplications: approved,   
                    rejectedApplications: rejected,   
                    verifiedApplications: verified,
                    admissionStatistics: {           
                        conversionRatePercent: parseFloat(conversionRate),
                        rejectionRatePercent: parseFloat(rejectionRate)
                    }
                },
                detailedStatusBreakdown: statusCounts
            }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// GET COURSE-WISE REGISTRATION STATISTICS FOR CHARTS
const getStatsByCourse = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Admin does not belong to any institution'
            });
        }

        // FETCH ALL COURSES FOR THE TENANT - INCLUDING THOSE WITH 0 APPLICATIONS
        const courses = await Course.find({ tenantId });

        // AGGREAGTE APPLICATION COUNTS GROUPED BY COURSEID
        const appStats = await Application.aggregate([
            { $match: { tenantId: new mongoose.Types.ObjectId(tenantId) } },
            {
                $group: {
                    _id: '$courseId',
                    total: { $sum: 1 },
                    admitted: { $sum: { $cond: [{ $eq: ['$status', 'admitted'] }, 1, 0] } },
                    pending: { $sum: { $cond: [{ $in: ['$status', ['draft', 'submitted', 'under_review']] }, 1, 0] } },
                    rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
                    verified: { $sum: { $cond: [{ $eq: ['$status', 'verified'] }, 1, 0] } },
                }
            }
        ]);

        // BUILD A MAP FOR QUICK LOOKUP
        const statsMap = {};
        appStats.forEach(stat => {
            if (stat._id) {
                statsMap[stat._id.toString()] = stat;
            }
        });

        // MAP COURSES WITH THEIR STATS 
        const courseData = courses.map(course => {
            const stats = statsMap[course._id.toString()] || {
                total: 0,
                admitted: 0,
                pending: 0,
                rejected: 0,
                verified: 0,
            };
            return {
                courseId: course._id,
                courseName: course.name,
                totalApplications: stats.total,
                admittedApplications: stats.admitted,
                pendingApplications: stats.pending,
                rejectedApplications: stats.rejected,
                verifiedApplications: stats.verified
            };
        });

        res.status(200).json({
            success: true,
            data: courseData
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// GET STUDENT APPLICATION'S DASHBOARD
const getStudentDashboard = async (req, res) => {
    try {
        const studentId = req.user.id;

        // FIND ALL APPLICATIONS FOR THE STUDENT WITH POPULATED COURSE INFO
        const applications = await Application.find({ applicantId: studentId })
            .populate('courseId', 'name requiredDocuments session')
            .sort({ updatedAt: -1 });

        const dashboardData = [];

        // PROCESS EACH APPLICATION
        for (const app of applications) {
            const course = app.courseId;
            const requiredDocTypes = (course && course.requiredDocuments) ? course.requiredDocuments : [];

            // FIND ALL DOCUMENTS FOR THIS APPLICATION
            const uploadedDocs = await Document.find({ applicationId: app._id });

            // DETERMINE MISSING AND REJECTED DOCUMENTS
            const uploadedTypes = uploadedDocs.map(doc => doc.type);
            const missingDocs = requiredDocTypes.filter(type => !uploadedTypes.includes(type));
            const rejectedDocs = uploadedDocs.filter(doc => doc.status === 'rejected').map(doc => ({
                id: doc._id,
                name: doc.name,
                type: doc.type,
                remarks: doc.remarks || 'No remarks provided'
            }));
            const reviewedAt = app.reviewedAt || app.updatedAt || null;

            // CONSTRUCT STATUS TIMELINE 
            const timelineSteps = [
                { 
                    step: 'Created', 
                    label: 'Application Created', 
                    status: 'completed', 
                    date: app.createdAt 
                },
                { 
                    step: 'Submitted', 
                    label: 'Application Submitted', 
                    status: app.status !== 'draft' ? 'completed' : 'upcoming', 
                    date: app.status !== 'draft' ? app.createdAt : null 
                },
                { 
                    step: 'Under Review', 
                    label: 'Under Review', 
                    status: ['under_review', 'verified', 'admitted', 'rejected'].includes(app.status) 
                        ? 'completed' 
                        : (app.status === 'submitted' ? 'current' : 'upcoming'), 
                    date: ['under_review', 'verified', 'admitted', 'rejected'].includes(app.status) ? reviewedAt : null 
                },
                { 
                    step: 'Verified', 
                    label: 'Document Verification', 
                    status: ['verified', 'admitted', 'rejected'].includes(app.status) 
                        ? 'completed' 
                        : (app.status === 'under_review' ? 'current' : 'upcoming'), 
                    date: ['verified', 'admitted', 'rejected'].includes(app.status) ? reviewedAt : null 
                },
                { 
                    step: 'Decision', 
                    label: 'Admission Decision', 
                    status: ['admitted', 'rejected'].includes(app.status) 
                        ? 'completed' 
                        : (app.status === 'verified' ? 'current' : 'upcoming'), 
                    date: ['admitted', 'rejected'].includes(app.status) ? reviewedAt : null 
                }
            ];

            // BUILD DASHBOARD ENTRY FOR THIS APPLICATION
            dashboardData.push({
                applicationId: app._id,
                course: {
                    id: course ? course._id : null,
                    name: course ? course.name : 'Unknown Course',
                    session: app.session || (course ? course.session : '')
                },
                applicationProgress: app.status,     
                remarks: app.remarks || '',
                statusTimeline: timelineSteps,       
                documents: {
                    uploaded: uploadedDocs.map(doc => ({
                        id: doc._id,
                        name: doc.name,
                        type: doc.type,
                        status: doc.status
                    })),
                    missingDocuments: missingDocs,   
                    rejectedDocuments: rejectedDocs
                }
            });
        }

        res.status(200).json({
            success: true,
            data: dashboardData
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

module.exports = {
    getAdminDashboard,
    getStatsByCourse,
    getStudentDashboard
};
