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

/* ============================================================================
   Small, local helpers used only by getStudentDashboard() below.
   No DB access, no new dependencies — pure formatting/derivation helpers so
   the extended response can be built from data we already fetched.
   ============================================================================ */

// Maps Application.status (existing enum, unchanged) -> the badge/stage key
// the redesigned frontend expects. Frontend has no equivalent for statuses
// outside this enum, so unmapped values just pass through unchanged.
const STATUS_TO_STAGE = {
    draft: 'draft',
    submitted: 'submitted',
    under_review: 'faculty_review',
    verified: 'verification',
    admitted: 'admitted',
    rejected: 'rejected'
};

function toStage(status) {
    return STATUS_TO_STAGE[status] || status;
}

function shortCode(id) {
    return `SS-${String(id || '').slice(-5).toUpperCase()}`;
}

function formatDate(dateInput) {
    if (!dateInput) return null;
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeAgo(dateInput) {
    if (!dateInput) return null;
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return null;
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function getStepDate(entry, stepName) {
    return entry.statusTimeline?.find(s => s.step === stepName)?.date || null;
}

function getLatestTimelineDate(entry) {
    const timestamps = (entry.statusTimeline || [])
        .map(s => s.date)
        .filter(Boolean)
        .map(d => new Date(d).getTime())
        .filter(t => !Number.isNaN(t));
    if (!timestamps.length) return null;
    return new Date(Math.max(...timestamps));
}

// GET STUDENT APPLICATION'S DASHBOARD
const getStudentDashboard = async (req, res) => {
    try {
        const studentId = req.user.id;

        // FIND ALL APPLICATIONS FOR THE STUDENT WITH POPULATED COURSE INFO
        // (unchanged — same query, same population as before)
        const applications = await Application.find({ applicantId: studentId })
            .populate('courseId', 'name requiredDocuments session')
            .sort({ updatedAt: -1 });

        const dashboardData = [];

        // PROCESS EACH APPLICATION
        // (unchanged — timeline generation, document processing, and
        // missing/rejected document logic are untouched)
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
            // (unchanged shape — still the original per-application object,
            // so any existing consumer of these exact fields keeps working)
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

        /* ------------------------------------------------------------------
           EVERYTHING BELOW IS NEW — built entirely from `dashboardData`
           (already computed above), with no additional DB queries. This
           extends the response for the redesigned student dashboard UI
           without touching the existing per-application computation.
           ------------------------------------------------------------------ */

        // ---- STUDENT PROFILE --------------------------------------------
        // No dedicated profile fields (name/email/profileCompletion) exist
        // on the current schema/JWT contract beyond req.user, so we read
        // what's available there and fall back to sensible defaults rather
        // than querying a model that may not have these fields.
        const student = {
            name: req.user.name || req.user.fullName || '',
            email: req.user.email || '',
            currentSession: dashboardData[0]?.course?.session || '',
            profileCompletion: 0 // not tracked in the current schema
        };

        // ---- STATS ---------------------------------------------------------
        const stats = [
            {
                key: 'submitted',
                label: 'Applications Submitted',
                value: dashboardData.filter(a => a.applicationProgress !== 'draft').length,
                icon: 'FileText',
                accent: '#FF6B3D'
            },
            {
                key: 'pending',
                label: 'Pending Review',
                value: dashboardData.filter(a => ['submitted', 'under_review'].includes(a.applicationProgress)).length,
                icon: 'Clock',
                accent: '#F59E0B'
            },
            {
                key: 'verified',
                label: 'Verified',
                value: dashboardData.filter(a => a.applicationProgress === 'verified').length,
                icon: 'ShieldCheck',
                accent: '#10B981'
            },
            {
                key: 'offers',
                label: 'Offers Received',
                value: dashboardData.filter(a => a.applicationProgress === 'admitted').length,
                icon: 'Award',
                accent: '#6366F1'
            }
        ];

        // ---- APPLICATIONS (frontend card shape) -----------------------------
        // Reuses dashboardData — just reshaped for the UI, no new queries.
        const uiApplications = dashboardData.map(entry => ({
            id: entry.applicationId,
            institution: 'Institution', // no institution field on Course/Application yet
            institutionColor: '#0F172A',
            course: entry.course?.name || 'Unknown Course',
            code: shortCode(entry.applicationId),
            session: entry.course?.session || '',
            submitted: formatDate(getStepDate(entry, 'Submitted') || getStepDate(entry, 'Created')),
            stage: toStage(entry.applicationProgress),
            deadline: null // no deadline field on the current schema
        }));

        // ---- ACTIVE APPLICATION ---------------------------------------------
        // Most recent non-draft, non-terminal application; falls back to the
        // most recent application overall.
        const activeEntry =
            dashboardData.find(a => !['draft', 'admitted', 'rejected'].includes(a.applicationProgress)) ||
            dashboardData[0] ||
            null;

        const activeApplication = activeEntry
            ? {
                code: shortCode(activeEntry.applicationId),
                institution: 'Institution',
                institutionColor: '#0F172A',
                courseName: activeEntry.course?.name || 'Unknown Course',
                status: toStage(activeEntry.applicationProgress),
                estProcessing: '5–7 business days', // static; no processing-time field in schema
                lastUpdated: timeAgo(getLatestTimelineDate(activeEntry))
            }
            : {};

        // ---- NOTIFICATIONS ---------------------------------------------------
        // Derived from documents.rejectedDocuments already computed above —
        // no extra queries.
        const notifications = [];
        dashboardData.forEach(entry => {
            (entry.documents?.rejectedDocuments || []).forEach(doc => {
                notifications.push({
                    id: doc.id,
                    title: 'Document Rejected',
                    detail: `${doc.name || doc.type} for ${entry.course?.name || 'your application'}: ${doc.remarks}`,
                    time: null, // no timestamp captured on rejected documents currently
                    tone: 'danger'
                });
            });
        });

        // ---- DEADLINES ---------------------------------------------------
        // Derived from documents.missingDocuments already computed above —
        // no extra queries. No real deadline date exists yet, so this is a
        // count-based reminder rather than a date.
        const deadlines = [];
        dashboardData.forEach(entry => {
            const missing = entry.documents?.missingDocuments || [];
            if (missing.length > 0) {
                deadlines.push({
                    id: `${entry.applicationId}-docs`,
                    label: 'Upload Documents',
                    value: `${missing.length} pending`,
                    detail: `${entry.course?.name || 'Application'} · ${missing.join(', ')}`,
                    icon: 'Upload',
                    tone: '#F59E0B'
                });
            }
        });

        // ---- RECOMMENDED COURSES --------------------------------------------
        // No recommendation logic or additional course fields (rating,
        // duration, institution) exist in the current schema, and adding a
        // new query here would violate "reuse existing data, no duplicate
        // queries." Returns an empty array as the sensible default.
        const recommendedCourses = [];

        return res.status(200).json({
            success: true,
            data: {
                student,
                stats,
                activeApplication,
                applications: uiApplications,
                notifications: notifications.slice(0, 6),
                deadlines: deadlines.slice(0, 4),
                recommendedCourses
            }
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