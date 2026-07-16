const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

// IMPORT ALL MODELS
const Institution = require('./src/models/institution');
const User = require('./src/models/user');
const Course = require('./src/models/course');
const FormTemplate = require('./src/models/formTemplate');
const Application = require('./src/models/application');
const Document = require('./src/models/document');
const Notification = require('./src/models/notification');
const AuditLog = require('./src/models/auditLog');
const ClassificationRule = require('./src/models/classificationRule');

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected for seeding...');

        // CLEAR OLD DATA
        await Institution.deleteMany();
        await User.deleteMany();
        await Course.deleteMany();
        await FormTemplate.deleteMany();
        await Application.deleteMany();
        await Document.deleteMany();
        await Notification.deleteMany();
        await AuditLog.deleteMany();
        await ClassificationRule.deleteMany();
        console.log('Old data cleared');

        const institution1 = await Institution.create({
            name: 'VJTI Mumbai',
            subdomain: 'vjti',
            contactEmail: 'admin@vjti.edu.in',
            contactPhone: '9876543210',
            address: 'Matunga, Mumbai',
            website: 'https://vjti.ac.in',
            admissionSession: '2026-27'
        });

        const institution2 = await Institution.create({
            name: 'IIT Bombay',
            subdomain: 'iitb',
            contactEmail: 'admin@iitb.ac.in',
            contactPhone: '9876500000',
            address: 'Powai, Mumbai',
            website: 'https://iitb.ac.in',
            admissionSession: '2026-27'
        });
        console.log('Institutions created');
        console.log('Instituion 1 : ', institution1._id);
        console.log('Institution 2 : ', institution2._id);

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('Test@123', salt);

        const superAdmin = await User.create({
            name: 'Super Admin',
            email: 'superadmin@scholarstack.com',
            passwordHash: hashedPassword,
            role: 'superAdmin',
            isEmailVerified: true
        });

        const instAdmin1 = await User.create({
            name: 'Aashu Goswami',
            email: 'admin@vjti.edu.in',
            passwordHash: hashedPassword,
            role: 'instAdmin',
            tenantId: institution1._id,
            isEmailVerified: true
        });

        const instAdmin2 = await User.create({
            name: 'Rajesh Kumar',
            email: 'admin@iitb.ac.in',
            passwordHash: hashedPassword,
            role: 'instAdmin',
            tenantId: institution2._id,
            isEmailVerified: true
        });

        const student1 = await User.create({
            name: 'Dhriti Sharma',
            email: 'dhriti@student.vjti.edu.in',
            passwordHash: hashedPassword,
            role: 'student',
            tenantId: institution1._id,
            isEmailVerified: true
        });

        const student2 = await User.create({
            name: 'Rahul Verma',
            email: 'rahul@student.vjti.edu.in',
            passwordHash: hashedPassword,
            role: 'student',
            tenantId: institution1._id,
            isEmailVerified: true
        });

        const student3 = await User.create({
            name: 'Priya Patel',
            email: 'priya@student.vjti.edu.in',
            passwordHash: hashedPassword,
            role: 'student',
            tenantId: institution1._id,
            isEmailVerified: true
        });

        const student4 = await User.create({
            name: 'Arjun Singh',
            email: 'arjun@student.vjti.edu.in',
            passwordHash: hashedPassword,
            role: 'student',
            tenantId: institution1._id,
            isEmailVerified: true
        });

        const student5 = await User.create({
            name: 'Sneha Joshi',
            email: 'sneha@student.iitb.ac.in',
            passwordHash: hashedPassword,
            role: 'student',
            tenantId: institution2._id,
            isEmailVerified: true
        });
        console.log('Users created');

        const course1 = await Course.create({
            name: 'B.Tech Computer Engineering',
            description: 'Four year undergraduate program in Computer Engineering',
            tenantId: institution1._id,
            eligibilityCriteria: [
                { field: 'twelfthPercentage', operator: '>=', value: 60 },
                { field: 'twelfthMaths', operator: '>=', value: 50 }
            ],
            admissionCapacity: 120,
            requiredDocuments: ['marksheet', 'certificate', 'idProof', 'photo'],
            session: '2026-27',
            createdBy: instAdmin1._id
        });

        const course2 = await Course.create({
            name: 'B.Tech Electronics and Telecommunication',
            description: 'Four year undergraduate program in E&TC',
            tenantId: institution1._id,
            eligibilityCriteria: [
                { field: 'twelfthPercentage', operator: '>=', value: 55 },
                { field: 'twelfthPhysics', operator: '>=', value: 50 }
            ],
            admissionCapacity: 90,
            requiredDocuments: ['marksheet', 'certificate', 'idProof', 'photo'],
            session: '2026-27',
            createdBy: instAdmin1._id
        });

        const course3 = await Course.create({
            name: 'B.Tech Mechanical Engineering',
            description: 'Four year undergraduate program in Mechanical Engineering',
            tenantId: institution1._id,
            eligibilityCriteria: [
                { field: 'twelfthPercentage', operator: '>=', value: 55 },
                { field: 'twelfthPhysics', operator: '>=', value: 45 }
            ],
            admissionCapacity: 60,
            requiredDocuments: ['marksheet', 'certificate', 'idProof', 'photo'],
            session: '2026-27',
            createdBy: instAdmin1._id
        });

        const course4 = await Course.create({
            name: 'M.Tech Computer Science',
            description: 'Two year postgraduate program in Computer Science',
            tenantId: institution2._id,
            eligibilityCriteria: [
                { field: 'graduationPercentage', operator: '>=', value: 65 }
            ],
            admissionCapacity: 50,
            requiredDocuments: ['marksheet', 'certificate', 'idProof', 'photo'],
            session: '2026-27',
            createdBy: instAdmin2._id
        });
        console.log('Courses created');
        console.log('Course 1 : ', course1._id);
        console.log('Course 2 : ', course2._id);
        console.log('Course 3 : ', course3._id);
        console.log('Course 4 : ', course4._id);

        const formTemplate1 = await FormTemplate.create({
            courseId: course1._id,
            tenantId: institution1._id,
            fields: [
                { label: 'Full Name', fieldKey: 'fullName', type: 'text', validation: { required: true }, order: 1 },
                { label: '12th Percentage', fieldKey: 'twelfthPercentage', type: 'number', validation: { required: true, min: 0, max: 100 }, order: 2 },
                { label: '12th Maths Marks', fieldKey: 'twelfthMaths', type: 'number', validation: { required: true, min: 0, max: 100 }, order: 3 },
                { label: 'Category', fieldKey: 'category', type: 'dropdown', validation: { required: true }, options: ['General', 'OBC', 'SC', 'ST', 'EWS'], order: 4 }
            ],
            createdBy: instAdmin1._id
        });

        const formTemplate2 = await FormTemplate.create({
            courseId: course2._id,
            tenantId: institution1._id,
            fields: [
                { label: 'Full Name', fieldKey: 'fullName', type: 'text', validation: { required: true }, order: 1 },
                { label: '12th Percentage', fieldKey: 'twelfthPercentage', type: 'number', validation: { required: true, min: 0, max: 100 }, order: 2 },
                { label: '12th Physics Marks', fieldKey: 'twelfthPhysics', type: 'number', validation: { required: true, min: 0, max: 100 }, order: 3 },
                { label: 'Category', fieldKey: 'category', type: 'dropdown', validation: { required: true }, options: ['General', 'OBC', 'SC', 'ST', 'EWS'], order: 4 }
            ],
            createdBy: instAdmin1._id
        });
        console.log('Form templates created');
        console.log('Form 1 :', formTemplate1._id);
        console.log('Form 2 : ', formTemplate2._id);

        const application1 = await Application.create({
            tenantId: institution1._id,
            courseId: course1._id,
            applicantId: student1._id,
            personalDetails: {
                fullName: 'Dhriti Sharma',
                twelfthPercentage: 92,
                twelfthMaths: 85,
                category: 'General'
            },
            session: '2026-27',
            status: 'submitted',
            submittedAt: new Date()
        });

        const application2 = await Application.create({
            tenantId: institution1._id,
            courseId: course2._id,
            applicantId: student2._id,
            personalDetails: {
                fullName: 'Rahul Verma',
                twelfthPercentage: 78,
                twelfthPhysics: 72,
                category: 'OBC'
            },
            session: '2026-27',
            status: 'under_review',
            submittedAt: new Date()
        });

        const application3 = await Application.create({
            tenantId: institution1._id,
            courseId: course1._id,
            applicantId: student3._id,
            personalDetails: {
                fullName: 'Priya Patel',
                twelfthPercentage: 88,
                twelfthMaths: 85,
                category: 'SC'
            },
            session: '2026-27',
            status: 'verified',
            submittedAt: new Date()
        });

        const application4 = await Application.create({
            tenantId: institution1._id,
            courseId: course3._id,
            applicantId: student4._id,
            personalDetails: {
                fullName: 'Arjun Singh',
                twelfthPercentage: 45,
                twelfthPhysics: 40,
                category: 'General'
            },
            session: '2026-27',
            status: 'rejected',
            submittedAt: new Date()
        });

        const application5 = await Application.create({
            tenantId: institution2._id,
            courseId: course4._id,
            applicantId: student5._id,
            personalDetails: {
                fullName: 'Sneha Joshi',
                graduationPercentage: 91,
                category: 'General'
            },
            session: '2026-27',
            status: 'admitted',
            submittedAt: new Date()
        });
        console.log('Applications created');
        console.log('Application 1 : ' , application1._id);
        console.log('Application 2 : ' , application2._id);
        console.log('Application 3 : ' , application3._id);
        console.log('Application 4 : ' , application4._id);
        console.log('Application 5 : ' , application5._id);

        await Document.create({
            name: '12th Marksheet',
            type: 'marksheet',
            fileUrl: '/uploads/documents/dhriti-marksheet.pdf',
            status: 'approved',
            applicantId: student1._id,
            applicationId: application1._id,
            tenantId: institution1._id,
            reviewedBy: instAdmin1._id,
            reviewedAt: new Date()
        });

        await Document.create({
            name: 'Aadhar Card',
            type: 'idProof',
            fileUrl: '/uploads/documents/dhriti-id.pdf',
            status: 'under review',
            applicantId: student1._id,
            applicationId: application1._id,
            tenantId: institution1._id
        });

        await Document.create({
            name: '12th Marksheet',
            type: 'marksheet',
            fileUrl: '/uploads/documents/rahul-marksheet.pdf',
            status: 'approved',
            applicantId: student2._id,
            applicationId: application2._id,
            tenantId: institution1._id,
            reviewedBy: instAdmin1._id,
            reviewedAt: new Date()
        });

        await Document.create({
            name: 'Passport Photo',
            type: 'photo',
            fileUrl: '/uploads/documents/priya-photo.jpg',
            status: 'approved',
            applicantId: student3._id,
            applicationId: application3._id,
            tenantId: institution1._id,
            reviewedBy: instAdmin1._id,
            reviewedAt: new Date()
        });

        await Document.create({
            name: 'Caste Certificate',
            type: 'certificate',
            fileUrl: '/uploads/documents/priya-caste.pdf',
            status: 'under review',
            applicantId: student3._id,
            applicationId: application3._id,
            tenantId: institution1._id
        });

        await Document.create({
            name: '12th Marksheet',
            type: 'marksheet',
            fileUrl: '/uploads/documents/arjun-marksheet.pdf',
            status: 'rejected',
            remarks: 'Marks do not meet minimum eligibility criteria',
            applicantId: student4._id,
            applicationId: application4._id,
            tenantId: institution1._id,
            reviewedBy: instAdmin1._id,
            reviewedAt: new Date()
        });
        console.log('Documents created');

        await Notification.create({
            tenantId: institution1._id,
            userId: student1._id,
            title: 'Application Submitted',
            message: 'Your application for B.Tech Computer Engineering has been submitted successfully.',
            type: 'application_submitted',
            isRead: false
        });

        await Notification.create({
            tenantId: institution1._id,
            userId: student2._id,
            title: 'Application Under Review',
            message: 'Your application for B.Tech E&TC is now under review.',
            type: 'status_updated',
            isRead: false
        });

        await Notification.create({
            tenantId: institution1._id,
            userId: student3._id,
            title: 'Application Verified',
            message: 'Your application has been verified successfully.',
            type: 'verification_completed',
            isRead: true
        });

        await Notification.create({
            tenantId: institution1._id,
            userId: student4._id,
            title: 'Application Rejected',
            message: 'Unfortunately your application has been rejected due to low marks.',
            type: 'admission_rejected',
            isRead: false
        });

        await Notification.create({
            tenantId: institution2._id,
            userId: student5._id,
            title: 'Congratulations! Admission Confirmed',
            message: 'You have been admitted to M.Tech Computer Science at IIT Bombay.',
            type: 'admission_approved',
            isRead: true
        });

        await Notification.create({
            tenantId: institution1._id,
            userId: student1._id,
            title: 'Document Approved',
            message: 'Your 12th Marksheet has been approved.',
            type: 'document_approved',
            isRead: false
        });
        console.log('Notifications created');

        await AuditLog.create({
            tenantId: institution1._id,
            applicationId: application2._id,
            fromStatus: 'submitted',
            toStatus: 'under_review',
            changedBy: instAdmin1._id,
            remarks: 'Application moved to review stage'
        });

        await AuditLog.create({
            tenantId: institution1._id,
            applicationId: application3._id,
            fromStatus: 'submitted',
            toStatus: 'under_review',
            changedBy: instAdmin1._id,
            remarks: 'Application moved to review stage'
        });

        await AuditLog.create({
            tenantId: institution1._id,
            applicationId: application3._id,
            fromStatus: 'under_review',
            toStatus: 'verified',
            changedBy: instAdmin1._id,
            remarks: 'All documents verified successfully'
        });

        await AuditLog.create({
            tenantId: institution1._id,
            applicationId: application4._id,
            fromStatus: 'submitted',
            toStatus: 'under_review',
            changedBy: instAdmin1._id,
            remarks: 'Application moved to review'
        });

        await AuditLog.create({
            tenantId: institution1._id,
            applicationId: application4._id,
            fromStatus: 'under_review',
            toStatus: 'rejected',
            changedBy: instAdmin1._id,
            remarks: 'Rejected due to low marks'
        });

        await AuditLog.create({
            tenantId: institution2._id,
            applicationId: application5._id,
            fromStatus: 'submitted',
            toStatus: 'under_review',
            changedBy: instAdmin2._id,
            remarks: 'Application under review'
        });

        await AuditLog.create({
            tenantId: institution2._id,
            applicationId: application5._id,
            fromStatus: 'under_review',
            toStatus: 'verified',
            changedBy: instAdmin2._id,
            remarks: 'Documents verified'
        });

        await AuditLog.create({
            tenantId: institution2._id,
            applicationId: application5._id,
            fromStatus: 'verified',
            toStatus: 'admitted',
            changedBy: instAdmin2._id,
            remarks: 'Student admitted successfully'
        });
        console.log('Audit logs created');

        await ClassificationRule.create({
            tenantId: institution1._id,
            highMeritThreshold: 85,
            mediumMeritThreshold: 60,
            reservedCategories: ['SC', 'ST', 'OBC', 'EWS'],
            eligibilityMinMarks: 50,
            courseSpecificRules: {
                [course1._id.toString()]: {
                    criteria: [
                        { field: 'twelfthPercentage', operator: '>=', value: 60 },
                        { field: 'twelfthMaths', operator: '>=', value: 50 }
                    ],
                    highMeritThreshold: 90,
                    mediumMeritThreshold: 70
                },
                [course2._id.toString()]: {
                    criteria: [
                        { field: 'twelfthPercentage', operator: '>=', value: 55 },
                        { field: 'twelfthPhysics', operator: '>=', value: 50 }
                    ]
                }
            }
        });

        await ClassificationRule.create({
            tenantId: institution2._id,
            highMeritThreshold: 90,
            mediumMeritThreshold: 70,
            reservedCategories: ['SC', 'ST', 'OBC', 'EWS'],
            eligibilityMinMarks: 65,
            courseSpecificRules: {
                [course4._id.toString()]: {
                    criteria: [
                        { field: 'graduationPercentage', operator: '>=', value: 65 }
                    ],
                    highMeritThreshold: 92,
                    mediumMeritThreshold: 75
                }
            }
        });
        console.log('Classification rules created');

        console.log('Login credentials (password for all: Test@123)');
        console.log('Super Admin   :', superAdmin.email);
        console.log('VJTI Admin    :', instAdmin1.email);
        console.log('IITB Admin    :', instAdmin2.email);
        console.log('Student 1     :', student1.email);
        console.log('Student 2     :', student2.email);
        console.log('Student 3     :', student3.email);
        console.log('Student 4     :', student4.email);
        console.log('Student 5     :', student5.email);

        process.exit(0);
    } catch (err) {
        console.error('Error seeding data:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
};

seedData();