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
const AdmissionStatus = require('./src/models/admissionStatus');
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
        await AdmissionStatus.deleteMany();
        await AuditLog.deleteMany();
        await ClassificationRule.deleteMany();
        console.log('Old data cleared');

        // 1. CREATE INSTITUTIONS
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

        // 2. CREATE USERS
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

        // 3. CREATE COURSES
        const course1 = await Course.create({
            name: 'B.Tech Computer Engineering',
            description: 'Four year undergraduate program in Computer Engineering',
            tenantId: institution1._id,
            eligibilityCriteria: { minPercentage: 60, subject: 'PCM' },
            admissionCapacity: 120,
            requiredDocuments: ['marksheet', 'certificate', 'idProof', 'photo'],
            session: '2026-27',
            createdBy: instAdmin1._id
        });

        const course2 = await Course.create({
            name: 'B.Tech Electronics and Telecommunication',
            description: 'Four year undergraduate program in E&TC',
            tenantId: institution1._id,
            eligibilityCriteria: { minPercentage: 55, subject: 'PCM' },
            admissionCapacity: 90,
            requiredDocuments: ['marksheet', 'certificate', 'idProof', 'photo'],
            session: '2026-27',
            createdBy: instAdmin1._id
        });

        const course3 = await Course.create({
            name: 'B.Tech Mechanical Engineering',
            description: 'Four year undergraduate program in Mechanical Engineering',
            tenantId: institution1._id,
            eligibilityCriteria: { minPercentage: 55, subject: 'PCM' },
            admissionCapacity: 60,
            requiredDocuments: ['marksheet', 'certificate', 'idProof', 'photo'],
            session: '2026-27',
            createdBy: instAdmin1._id
        });

        const course4 = await Course.create({
            name: 'M.Tech Computer Science',
            description: 'Two year postgraduate program in Computer Science',
            tenantId: institution2._id,
            eligibilityCriteria: { minPercentage: 65, subject: 'Engineering' },
            admissionCapacity: 50,
            requiredDocuments: ['marksheet', 'certificate', 'idProof', 'photo'],
            session: '2026-27',
            createdBy: instAdmin2._id
        });
        console.log('Courses created');

        // 4. CREATE FORM TEMPLATES
        const formTemplate1 = await FormTemplate.create({
            courseId: course1._id,
            tenantId: institution1._id,
            fields: [
                { label: 'Full Name', fieldKey: 'fullName', type: 'text', required: true, order: 1 },
                { label: '12th Percentage', fieldKey: 'twelfthPercentage', type: 'number', required: true, order: 2 },
                { label: 'Category', fieldKey: 'category', type: 'dropdown', required: true, options: ['General', 'OBC', 'SC', 'ST', 'EWS'], order: 3 },
                { label: 'Mathematics Marks', fieldKey: 'mathMarks', type: 'number', required: true, order: 4 },
                { label: 'Physics Marks', fieldKey: 'physicsMarks', type: 'number', required: true, order: 5 }
            ],
            createdBy: instAdmin1._id
        });

        const formTemplate2 = await FormTemplate.create({
            courseId: course2._id,
            tenantId: institution1._id,
            fields: [
                { label: 'Full Name', fieldKey: 'fullName', type: 'text', required: true, order: 1 },
                { label: '12th Percentage', fieldKey: 'twelfthPercentage', type: 'number', required: true, order: 2 },
                { label: 'Category', fieldKey: 'category', type: 'dropdown', required: true, options: ['General', 'OBC', 'SC', 'ST', 'EWS'], order: 3 },
                { label: 'Have you studied Electronics?', fieldKey: 'studiedElectronics', type: 'radio', required: true, options: ['Yes', 'No'], order: 4 }
            ],
            createdBy: instAdmin1._id
        });
        console.log('Form templates created');

        // 5. CREATE APPLICATIONS
        const application1 = await Application.create({
            tenantId: institution1._id,
            courseId: course1._id,
            applicantId: student1._id,
            personalDetails: { fullName: 'Dhriti Sharma', twelfthPercentage: 92, category: 'General', mathMarks: 95, physicsMarks: 90 },
            session: '2026-27',
            status: 'submitted',
            submittedAt: new Date()
        });

        const application2 = await Application.create({
            tenantId: institution1._id,
            courseId: course2._id,
            applicantId: student2._id,
            personalDetails: { fullName: 'Rahul Verma', twelfthPercentage: 78, category: 'OBC', studiedElectronics: 'Yes' },
            session: '2026-27',
            status: 'under_review',
            submittedAt: new Date()
        });

        const application3 = await Application.create({
            tenantId: institution1._id,
            courseId: course1._id,
            applicantId: student3._id,
            personalDetails: { fullName: 'Priya Patel', twelfthPercentage: 88, category: 'SC', mathMarks: 85, physicsMarks: 82 },
            session: '2026-27',
            status: 'verified',
            submittedAt: new Date()
        });

        const application4 = await Application.create({
            tenantId: institution1._id,
            courseId: course3._id,
            applicantId: student4._id,
            personalDetails: { fullName: 'Arjun Singh', twelfthPercentage: 45, category: 'General' },
            session: '2026-27',
            status: 'rejected',
            submittedAt: new Date()
        });

        const application5 = await Application.create({
            tenantId: institution2._id,
            courseId: course4._id,
            applicantId: student5._id,
            personalDetails: { fullName: 'Sneha Joshi', twelfthPercentage: 91, category: 'General' },
            session: '2026-27',
            status: 'admitted',
            submittedAt: new Date()
        });
        console.log('Applications created');

        // 6. CREATE DOCUMENTS
        await Document.create({
            name: '12th Marksheet',
            type: 'marksheet',
            fileUrl: '/uploads/documents/dhriti-marksheet.pdf',
            status: 'approved',
            studentId: student1._id,
            applicationId: application1._id,
            tenantId: institution1._id,
            reviewedBy: instAdmin1._id,
            reviewedAt: new Date()
        });

        await Document.create({
            name: 'Aadhar Card',
            type: 'idProof',
            fileUrl: '/uploads/documents/dhriti-id.pdf',
            status: 'pending',
            studentId: student1._id,
            applicationId: application1._id,
            tenantId: institution1._id
        });

        await Document.create({
            name: '12th Marksheet',
            type: 'marksheet',
            fileUrl: '/uploads/documents/rahul-marksheet.pdf',
            status: 'approved',
            studentId: student2._id,
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
            studentId: student3._id,
            applicationId: application3._id,
            tenantId: institution1._id,
            reviewedBy: instAdmin1._id,
            reviewedAt: new Date()
        });

        await Document.create({
            name: 'Caste Certificate',
            type: 'certificate',
            fileUrl: '/uploads/documents/priya-caste.pdf',
            status: 'pending',
            studentId: student3._id,
            applicationId: application3._id,
            tenantId: institution1._id
        });

        await Document.create({
            name: '12th Marksheet',
            type: 'marksheet',
            fileUrl: '/uploads/documents/arjun-marksheet.pdf',
            status: 'rejected',
            remarks: 'Marks do not meet minimum eligibility criteria',
            studentId: student4._id,
            applicationId: application4._id,
            tenantId: institution1._id,
            reviewedBy: instAdmin1._id,
            reviewedAt: new Date()
        });
        console.log('Documents created');

        // 7. CREATE NOTIFICATIONS
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

        // 8. CREATE ADMISSION STATUSES
        await AdmissionStatus.create({
            applicationId: application1._id,
            tenantId: institution1._id,
            studentId: student1._id,
            classification: 'high_merit',
            remarks: 'Student has scored above 90% - High Merit category',
            classifiedBy: instAdmin1._id,
            classifiedAt: new Date()
        });

        await AdmissionStatus.create({
            applicationId: application2._id,
            tenantId: institution1._id,
            studentId: student2._id,
            classification: 'eligible',
            remarks: 'Student meets eligibility criteria',
            classifiedBy: instAdmin1._id,
            classifiedAt: new Date()
        });

        await AdmissionStatus.create({
            applicationId: application3._id,
            tenantId: institution1._id,
            studentId: student3._id,
            classification: 'reserved_category',
            remarks: 'Student belongs to SC category',
            classifiedBy: instAdmin1._id,
            classifiedAt: new Date()
        });

        await AdmissionStatus.create({
            applicationId: application4._id,
            tenantId: institution1._id,
            studentId: student4._id,
            classification: 'not_eligible',
            remarks: 'Student scored below minimum eligibility marks',
            classifiedBy: instAdmin1._id,
            classifiedAt: new Date()
        });

        await AdmissionStatus.create({
            applicationId: application5._id,
            tenantId: institution2._id,
            studentId: student5._id,
            classification: 'high_merit',
            remarks: 'Excellent academic record',
            classifiedBy: instAdmin2._id,
            classifiedAt: new Date()
        });
        console.log('Admission statuses created');

        // 9. CREATE AUDIT LOGS
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

        // 10. CREATE CLASSIFICATION RULES
        await ClassificationRule.create({
            tenantId: institution1._id,
            highMeritThreshold: 85,
            mediumMeritThreshold: 60,
            reservedCategories: ['SC', 'ST', 'OBC', 'EWS'],
            eligibilityMinMarks: 50,
            courseSpecificRules: {
                'B.Tech Computer Engineering': { minMathMarks: 70 },
                'B.Tech Electronics and Telecommunication': { minPhysicsMarks: 60 }
            }
        });

        await ClassificationRule.create({
            tenantId: institution2._id,
            highMeritThreshold: 90,
            mediumMeritThreshold: 70,
            reservedCategories: ['SC', 'ST', 'OBC', 'EWS'],
            eligibilityMinMarks: 65,
            courseSpecificRules: {
                'M.Tech Computer Science': { minGraduationMarks: 65 }
            }
        });
        console.log('Classification rules created');

        console.log('\n✅ SEEDING COMPLETE! All collections populated.\n');
        console.log('Login credentials (password for all: Test@123)');
        console.log('Super Admin:', superAdmin.email);
        console.log('VJTI Admin:', instAdmin1.email);
        console.log('IITB Admin:', instAdmin2.email);
        console.log('Student 1:', student1.email);
        console.log('Student 2:', student2.email);
        console.log('Student 3:', student3.email);
        console.log('Student 4:', student4.email);
        console.log('Student 5:', student5.email);

        process.exit(0);
    } catch (err) {
        console.error('Error seeding data:', err.message);
        process.exit(1);
    }
};

seedData();