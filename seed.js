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
        console.log('Old data cleared');

        // 1. CREATE INSTITUTION
        const institution = await Institution.create({
            name: 'VJTI Mumbai',
            subdomain: 'vjti',
            contactEmail: 'admin@vjti.edu.in',
            contactPhone: '9876543210',
            address: 'Matunga, Mumbai',
            website: 'https://vjti.ac.in',
            admissionSession: '2026-27'
        });
        console.log('Institution created');

        // 2. CREATE USERS (super admin, inst admin, students)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('Test@123', salt);

        const superAdmin = await User.create({
            name: 'Super Admin',
            email: 'superadmin@scholarstack.com',
            passwordHash: hashedPassword,
            role: 'superAdmin',
            isEmailVerified: true
        });

        const instAdmin = await User.create({
            name: 'Aashu Goswami',
            email: 'admin@vjti.edu.in',
            passwordHash: hashedPassword,
            role: 'instAdmin',
            tenantId: institution._id,
            isEmailVerified: true
        });

        const student1 = await User.create({
            name: 'Dhriti Sharma',
            email: 'dhriti@student.vjti.edu.in',
            passwordHash: hashedPassword,
            role: 'student',
            tenantId: institution._id,
            isEmailVerified: true
        });

        const student2 = await User.create({
            name: 'Rahul Verma',
            email: 'rahul@student.vjti.edu.in',
            passwordHash: hashedPassword,
            role: 'student',
            tenantId: institution._id,
            isEmailVerified: true
        });

        console.log('Users created');

        // 3. CREATE COURSES
        const course1 = await Course.create({
            name: 'B.Tech Computer Engineering',
            description: 'Four year undergraduate program in Computer Engineering',
            tenantId: institution._id,
            eligibilityCriteria: { minPercentage: 60, subject: 'PCM' },
            admissionCapacity: 120,
            requiredDocuments: ['marksheet', 'certificate', 'idProof', 'photo'],
            session: '2026-27',
            createdBy: instAdmin._id
        });

        const course2 = await Course.create({
            name: 'B.Tech Electronics and Telecommunication',
            description: 'Four year undergraduate program in E&TC',
            tenantId: institution._id,
            eligibilityCriteria: { minPercentage: 55, subject: 'PCM' },
            admissionCapacity: 90,
            requiredDocuments: ['marksheet', 'certificate', 'idProof', 'photo'],
            session: '2026-27',
            createdBy: instAdmin._id
        });

        console.log('Courses created');

        // 4. CREATE FORM TEMPLATE FOR COURSE 1
        const formTemplate1 = await FormTemplate.create({
            courseId: course1._id,
            tenantId: institution._id,
            fields: [
                { label: 'Full Name', fieldKey: 'fullName', type: 'text', required: true, order: 1 },
                { label: '12th Percentage', fieldKey: 'twelfthPercentage', type: 'number', required: true, order: 2 },
                { label: 'Category', fieldKey: 'category', type: 'dropdown', required: true, options: ['General', 'OBC', 'SC', 'ST'], order: 3 }
            ],
            createdBy: instAdmin._id
        });

        console.log('Form template created');

        // 5. CREATE APPLICATIONS
        const application1 = await Application.create({
            tenantId: institution._id,
            courseId: course1._id,
            applicantId: student1._id,
            personalDetails: { fullName: 'Dhriti Sharma', twelfthPercentage: 92, category: 'General' },
            session: '2026-27',
            status: 'submitted',
            submittedAt: new Date()
        });

        const application2 = await Application.create({
            tenantId: institution._id,
            courseId: course2._id,
            applicantId: student2._id,
            personalDetails: { fullName: 'Rahul Verma', twelfthPercentage: 78, category: 'OBC' },
            session: '2026-27',
            status: 'under_review'
        });

        console.log('Applications created');

        // 6. CREATE DOCUMENTS
        await Document.create({
            name: '12th Marksheet',
            type: 'marksheet',
            fileUrl: '/uploads/documents/sample-marksheet.pdf',
            status: 'pending',
            studentId: student1._id,
            applicationId: application1._id,
            tenantId: institution._id
        });

        await Document.create({
            name: 'Aadhar Card',
            type: 'idProof',
            fileUrl: '/uploads/documents/sample-id.pdf',
            status: 'approved',
            studentId: student2._id,
            applicationId: application2._id,
            tenantId: institution._id,
            reviewedBy: instAdmin._id,
            reviewedAt: new Date()
        });

        console.log('Documents created');

        // 7. CREATE NOTIFICATIONS
        await Notification.create({
            tenantId: institution._id,
            userId: student1._id,
            title: 'Application Submitted',
            message: 'Your application for B.Tech Computer Engineering has been submitted successfully.',
            type: 'application',
            isRead: false
        });

        await Notification.create({
            tenantId: institution._id,
            userId: student2._id,
            title: 'Application Under Review',
            message: 'Your application is now under review.',
            type: 'status_update',
            isRead: false
        });

        console.log('Notifications created');

        console.log('\n✅ SEEDING COMPLETE! Test data populated successfully.\n');
        console.log('Login credentials (password for all: Test@123):');
        console.log('Super Admin:', superAdmin.email);
        console.log('Institution Admin:', instAdmin.email);
        console.log('Student 1:', student1.email);
        console.log('Student 2:', student2.email);

        process.exit(0);
    } catch (err) {
        console.error('Error seeding data:', err);
        process.exit(1);
    }
};

seedData();