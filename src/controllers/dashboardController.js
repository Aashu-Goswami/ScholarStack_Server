/**
 * @file controllers/dashboardController.js
 * @description Controller implementing administrative and student dashboards for the ScholarStack portal (Module 10).
 * Computes multi-tenant KPI aggregations, Course-wise registration statistics for charts, 
 * and provides applicants with real-time status timelines, required document checklists, and alerts.
 */

const Application = require('../models/application');
const Course = require('../models/course');
const Document = require('../models/document');
const mongoose = require('mongoose');

/**
 * @route GET /api/dashboard/admin
 * @description Retrieve KPI summary metrics, status-wise counts, and conversion rates for the logged-in admin's tenant.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const getAdminDashboard = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Admin does not belong to any institution'
            });
        }

        // Count totals grouped by status using aggregation
        const counts = await Application.aggregate([
            { $match: { tenantId: new mongoose.Types.ObjectId(tenantId) } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

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

        // Compute summary aggregates
        const under_review = statusCounts.submitted + statusCounts.under_review;
        const approved = statusCounts.admitted;
        const rejected = statusCounts.rejected;
        const verified = statusCounts.verified;
        const draft = statusCounts.draft;

        // Compute Admission Statistics (Module 10 - Admission Statistics)
        const conversionRate = total > 0 ? ((approved / total) * 100).toFixed(2) : "0.00";
        const rejectionRate = total > 0 ? ((rejected / total) * 100).toFixed(2) : "0.00";

        res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalApplications: total,         
                    under_reviewApplications: under_review,     
                    approvedApplications: approved,   
                    rejectedApplications: rejected,   
                    verifiedApplications: verified,
                    draftApplications: draft,
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

/**
 * @route GET /api/dashboard/admin/stats/by-course
 * @description Retrieve registration statistics and applications grouped by course, structured for frontend chart components (e.g. Recharts).
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const getStatsByCourse = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Admin does not belong to any institution'
            });
        }

        // Fetch all courses for the tenant to ensure courses with 0 applications are represented
        const courses = await Course.find({ tenantId });

        // Retrieve aggregated stats grouped by courseId (Module 10 - Applications by Course)
        const appStats = await Application.aggregate([
            { $match: { tenantId: new mongoose.Types.ObjectId(tenantId) } },
            {
                $group: {
                    _id: '$courseId',
                    total: { $sum: 1 },
                    admitted: { $sum: { $cond: [{ $eq: ['$status', 'admitted'] }, 1, 0] } },
                    under_review: { $sum: { $cond: [{ $in: ['$status', ['submitted', 'under_review']] }, 1, 0] } },
                    rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
                    verified: { $sum: { $cond: [{ $eq: ['$status', 'verified'] }, 1, 0] } },
                    draft: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } }
                }
            }
        ]);

        const statsMap = {};
        appStats.forEach(stat => {
            if (stat._id) {
                statsMap[stat._id.toString()] = stat;
            }
        });

        // Map courses with their corresponding counts
        const courseData = courses.map(course => {
            const stats = statsMap[course._id.toString()] || {
                total: 0,
                admitted: 0,
                under_review: 0,
                rejected: 0,
                verified: 0,
                draft: 0
            };
            return {
                courseId: course._id,
                courseName: course.name,
                totalApplications: stats.total,
                admittedApplications: stats.admitted,
                under_reviewApplications: stats.under_review,
                rejectedApplications: stats.rejected,
                verifiedApplications: stats.verified,
                draftApplications: stats.draft
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

/**
 * @route GET /api/dashboard/student
 * @description Retrieve the application progress, missing required documents, and verification milestones/status timeline for the applicant.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const getStudentDashboard = async (req, res) => {
    try {
        const studentId = req.user.id;

        // Find all applications submitted by the logged-in student, populating course info
        const applications = await Application.find({ applicantId: studentId })
            .populate('courseId', 'name requiredDocuments session')
            .sort({ updatedAt: -1 });

        const dashboardData = [];

        for (const app of applications) {
            const course = app.courseId;
            const requiredDocTypes = (course && course.requiredDocuments) ? course.requiredDocuments : [];

            // Find all uploaded documents for this application
            const uploadedDocs = await Document.find({ applicationId: app._id });

            const uploadedTypes = uploadedDocs.map(doc => doc.type);
            const missingDocs = requiredDocTypes.filter(type => !uploadedTypes.includes(type));
            const rejectedDocs = uploadedDocs.filter(doc => doc.status === 'rejected').map(doc => ({
                id: doc._id,
                name: doc.name,
                type: doc.type,
                remarks: doc.remarks || 'No remarks provided'
            }));
            const reviewedAt = app.reviewedAt || app.updatedAt || null;

            // Construct dynamic status timeline based on application status (Module 10 - Status Timeline)
            const timelineSteps = [
                { step: 'Created', label: 'Application Created', status: 'completed', date: app.createdAt },
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
