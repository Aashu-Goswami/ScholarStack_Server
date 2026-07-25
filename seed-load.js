const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

// IMPORT ALL MODELS - same as your original seed.js
const Institution = require('./src/models/institution');
const User = require('./src/models/user');
const Course = require('./src/models/course');
const FormTemplate = require('./src/models/formTemplate');
const Application = require('./src/models/application');
const Document = require('./src/models/document');
const Notification = require('./src/models/notification');
const AuditLog = require('./src/models/auditLog');
const ClassificationRule = require('./src/models/classificationRule');

// ============================================================
// CONFIG - tune these to control how much data gets generated.
// Start with NUM_STUDENTS: 500-600 for a realistic "early-stage
// platform" load test. Bump to 2000+ later if you want to see
// how things degrade at bigger scale.
// ============================================================
const CONFIG = {
  NUM_STUDENTS: 5000,
  INSTITUTION1_SHARE: 0.7,       // 80% VJTI, 20% IITB - matches your original ratio
  DOCS_PER_APPLICATION: [1, 3],  // random range
  NOTIFS_PER_STUDENT: [1, 3],
};

// Weighted so every application status bucket has enough records
// to make admin/filter, classification stats, and dashboard
// aggregations meaningful to test.
const STATUS_WEIGHTS = [
  { status: 'submitted', weight: 30 },
  { status: 'under_review', weight: 25 },
  { status: 'verified', weight: 20 },
  { status: 'rejected', weight: 10 },
  { status: 'admitted', weight: 15 },
];

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Krishna', 'Ishaan', 'Rohan',
  'Ananya', 'Diya', 'Aadhya', 'Saanvi', 'Myra', 'Aarohi', 'Ira', 'Kiara', 'Anika', 'Riya',
  'Kabir', 'Dhruv', 'Yash', 'Aryan', 'Karan', 'Neha', 'Pooja', 'Sneha', 'Priya', 'Meera',
  'Rahul', 'Rajesh', 'Amit', 'Vikram', 'Sanjay', 'Anjali', 'Divya', 'Shreya', 'Nisha', 'Kavya',
];
const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Singh', 'Joshi', 'Gupta', 'Reddy', 'Iyer', 'Nair', 'Menon',
  'Rao', 'Kulkarni', 'Deshmukh', 'Chopra', 'Malhotra', 'Kapoor', 'Mehta', 'Shah', 'Agarwal', 'Bhatt',
];
const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS'];
const DOC_TYPES = ['marksheet', 'certificate', 'idProof', 'photo'];
const NOTIF_TEMPLATES = [
  { title: 'Application Submitted', message: 'Your application has been submitted successfully.', type: 'application_submitted' },
  { title: 'Application Under Review', message: 'Your application is now under review.', type: 'status_updated' },
  { title: 'Application Verified', message: 'Your application has been verified successfully.', type: 'verification_completed' },
  { title: 'Document Approved', message: 'One of your documents has been approved.', type: 'document_approved' },
];
const STATUS_FLOW = ['submitted', 'under_review', 'verified', 'admitted'];

function randomName() {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${first} ${last}`;
}

function randomInRange([min, max]) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomCategory() {
  return CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
}

function weightedRandomStatus() {
  const totalWeight = STATUS_WEIGHTS.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.random() * totalWeight;
  for (const s of STATUS_WEIGHTS) {
    if (r < s.weight) return s.status;
    r -= s.weight;
  }
  return STATUS_WEIGHTS[0].status;
}

function randomMarks() {
  // Skewed into three bands so high/medium/low merit classification
  // buckets all end up populated - otherwise classify-all has nothing
  // interesting to sort into.
  const bucket = Math.random();
  if (bucket < 0.3) return randomInRange([85, 99]);
  if (bucket < 0.7) return randomInRange([60, 84]);
  return randomInRange([35, 59]);
}

const seedBulkData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected for bulk seeding...');
    console.log('DB URI host:', new URL(process.env.MONGO_URI.replace('mongodb+srv://', 'https://').replace('mongodb://', 'https://')).hostname);
    console.log('>> Make sure this points at a LOCAL/DEV database, not production, before continuing. <<\n');

    await Promise.all([
      Institution.deleteMany(), User.deleteMany(), Course.deleteMany(),
      FormTemplate.deleteMany(), Application.deleteMany(), Document.deleteMany(),
      Notification.deleteMany(), AuditLog.deleteMany(), ClassificationRule.deleteMany(),
    ]);
    console.log('Old data cleared');

    // ---------- 1. Institutions ----------
    const institution1 = await Institution.create({
      name: 'VJTI Mumbai', subdomain: 'vjti', contactEmail: 'admin@vjti.edu.in',
      contactPhone: '9876543210', address: 'Matunga, Mumbai',
      website: 'https://vjti.ac.in', admissionSession: '2026-27',
    });
    const institution2 = await Institution.create({
      name: 'IIT Bombay', subdomain: 'iitb', contactEmail: 'admin@iitb.ac.in',
      contactPhone: '9876500000', address: 'Powai, Mumbai',
      website: 'https://iitb.ac.in', admissionSession: '2026-27',
    });
    console.log('Institutions created');
    console.log('Institution 1 :', institution1._id);
    console.log('Institution 2 :', institution2._id);

    // ---------- 2. Fixed admin/super-admin users ----------
    const salt = await bcrypt.genSalt(10);
    // Hashed ONCE and reused for every dummy user below - hashing per-user
    // would make seeding 600+ students noticeably slower for no test benefit.
    const hashedPassword = await bcrypt.hash('Test@123', salt);

    const superAdmin = await User.create({
      name: 'Super Admin', email: 'superadmin@scholarstack.com',
      passwordHash: hashedPassword, role: 'superAdmin', isEmailVerified: true,
    });
    const instAdmin1 = await User.create({
      name: 'Aashu Goswami', email: 'admin@vjti.edu.in',
      passwordHash: hashedPassword, role: 'instAdmin', tenantId: institution1._id, isEmailVerified: true,
    });
    const instAdmin2 = await User.create({
      name: 'Rajesh Kumar', email: 'admin@iitb.ac.in',
      passwordHash: hashedPassword, role: 'instAdmin', tenantId: institution2._id, isEmailVerified: true,
    });
    console.log('Admin users created');

    // ---------- 3. Courses ----------
    const course1 = await Course.create({
      name: 'B.Tech Computer Engineering', description: 'Four year undergraduate program in Computer Engineering',
      tenantId: institution1._id,
      eligibilityCriteria: [{ field: 'twelfthPercentage', operator: '>=', value: 60 }, { field: 'twelfthMaths', operator: '>=', value: 50 }],
      admissionCapacity: 120, requiredDocuments: DOC_TYPES, session: '2026-27', createdBy: instAdmin1._id,
    });
    const course2 = await Course.create({
      name: 'B.Tech Electronics and Telecommunication', description: 'Four year undergraduate program in E&TC',
      tenantId: institution1._id,
      eligibilityCriteria: [{ field: 'twelfthPercentage', operator: '>=', value: 55 }, { field: 'twelfthPhysics', operator: '>=', value: 50 }],
      admissionCapacity: 90, requiredDocuments: DOC_TYPES, session: '2026-27', createdBy: instAdmin1._id,
    });
    const course3 = await Course.create({
      name: 'B.Tech Mechanical Engineering', description: 'Four year undergraduate program in Mechanical Engineering',
      tenantId: institution1._id,
      eligibilityCriteria: [{ field: 'twelfthPercentage', operator: '>=', value: 55 }, { field: 'twelfthPhysics', operator: '>=', value: 45 }],
      admissionCapacity: 60, requiredDocuments: DOC_TYPES, session: '2026-27', createdBy: instAdmin1._id,
    });
    const course4 = await Course.create({
      name: 'M.Tech Computer Science', description: 'Two year postgraduate program in Computer Science',
      tenantId: institution2._id,
      eligibilityCriteria: [{ field: 'graduationPercentage', operator: '>=', value: 65 }],
      admissionCapacity: 50, requiredDocuments: DOC_TYPES, session: '2026-27', createdBy: instAdmin2._id,
    });
    const inst1Courses = [course1, course2, course3];
    const inst2Courses = [course4];
    console.log('Courses created');

    // ---------- 4. Form templates ----------
    await FormTemplate.create({
      courseId: course1._id, tenantId: institution1._id,
      fields: [
        { label: 'Full Name', fieldKey: 'fullName', type: 'text', validation: { required: true }, order: 1 },
        { label: '12th Percentage', fieldKey: 'twelfthPercentage', type: 'number', validation: { required: true, min: 0, max: 100 }, order: 2 },
        { label: '12th Maths Marks', fieldKey: 'twelfthMaths', type: 'number', validation: { required: true, min: 0, max: 100 }, order: 3 },
        { label: 'Category', fieldKey: 'category', type: 'dropdown', validation: { required: true }, options: CATEGORIES, order: 4 },
      ],
      createdBy: instAdmin1._id,
    });
    await FormTemplate.create({
      courseId: course2._id, tenantId: institution1._id,
      fields: [
        { label: 'Full Name', fieldKey: 'fullName', type: 'text', validation: { required: true }, order: 1 },
        { label: '12th Percentage', fieldKey: 'twelfthPercentage', type: 'number', validation: { required: true, min: 0, max: 100 }, order: 2 },
        { label: '12th Physics Marks', fieldKey: 'twelfthPhysics', type: 'number', validation: { required: true, min: 0, max: 100 }, order: 3 },
        { label: 'Category', fieldKey: 'category', type: 'dropdown', validation: { required: true }, options: CATEGORIES, order: 4 },
      ],
      createdBy: instAdmin1._id,
    });
    console.log('Form templates created');

    // ---------- 5. Classification rules ----------
    await ClassificationRule.create({
      tenantId: institution1._id, highMeritThreshold: 85, mediumMeritThreshold: 60,
      reservedCategories: ['SC', 'ST', 'OBC', 'EWS'], eligibilityMinMarks: 50,
      courseSpecificRules: {
        [course1._id.toString()]: { criteria: [{ field: 'twelfthPercentage', operator: '>=', value: 60 }, { field: 'twelfthMaths', operator: '>=', value: 50 }], highMeritThreshold: 90, mediumMeritThreshold: 70 },
        [course2._id.toString()]: { criteria: [{ field: 'twelfthPercentage', operator: '>=', value: 55 }, { field: 'twelfthPhysics', operator: '>=', value: 50 }] },
      },
    });
    await ClassificationRule.create({
      tenantId: institution2._id, highMeritThreshold: 90, mediumMeritThreshold: 70,
      reservedCategories: ['SC', 'ST', 'OBC', 'EWS'], eligibilityMinMarks: 65,
      courseSpecificRules: {
        [course4._id.toString()]: { criteria: [{ field: 'graduationPercentage', operator: '>=', value: 65 }], highMeritThreshold: 92, mediumMeritThreshold: 75 },
      },
    });
    console.log('Classification rules created');

    // ---------- 6. BULK students ----------
    const numInst1Students = Math.round(CONFIG.NUM_STUDENTS * CONFIG.INSTITUTION1_SHARE);
    const numInst2Students = CONFIG.NUM_STUDENTS - numInst1Students;

    const studentDocs = [];
    for (let i = 0; i < numInst1Students; i++) {
      studentDocs.push({
        name: randomName(), email: `student${i}.vjti@test.scholarstack.com`,
        passwordHash: hashedPassword, role: 'student', tenantId: institution1._id, isEmailVerified: true,
      });
    }
    for (let i = 0; i < numInst2Students; i++) {
      studentDocs.push({
        name: randomName(), email: `student${i}.iitb@test.scholarstack.com`,
        passwordHash: hashedPassword, role: 'student', tenantId: institution2._id, isEmailVerified: true,
      });
    }
    // insertMany = one round trip instead of 600 sequential .create() calls
    const insertedStudents = await User.insertMany(studentDocs);
    console.log(`${insertedStudents.length} student users created`);

    // ---------- 7. BULK applications (1 per student) ----------
    const applicationDocs = insertedStudents.map((student) => {
      const isInst1 = student.tenantId.equals(institution1._id);
      const course = isInst1
        ? inst1Courses[Math.floor(Math.random() * inst1Courses.length)]
        : inst2Courses[Math.floor(Math.random() * inst2Courses.length)];
      const category = randomCategory();

      const personalDetails = isInst1
        ? { fullName: student.name, twelfthPercentage: randomMarks(), twelfthMaths: randomMarks(), twelfthPhysics: randomMarks(), category }
        : { fullName: student.name, graduationPercentage: randomMarks(), category };

      return {
        tenantId: student.tenantId,
        courseId: course._id,
        applicantId: student._id,
        personalDetails,
        session: '2026-27',
        status: weightedRandomStatus(),
        submittedAt: new Date(Date.now() - randomInRange([0, 60]) * 24 * 60 * 60 * 1000), // spread over last 60 days
      };
    });
    const insertedApplications = await Application.insertMany(applicationDocs);
    console.log(`${insertedApplications.length} applications created`);

    // ---------- 8. BULK documents (1-3 per application) ----------
    const documentDocs = [];
    for (const app of insertedApplications) {
      const numDocs = randomInRange(CONFIG.DOCS_PER_APPLICATION);
      const shuffledTypes = [...DOC_TYPES].sort(() => Math.random() - 0.5).slice(0, numDocs);
      for (const type of shuffledTypes) {
        const label = type === 'marksheet' ? '12th Marksheet' : type === 'certificate' ? 'Category Certificate' : type === 'idProof' ? 'Aadhar Card' : 'Passport Photo';
        documentDocs.push({
          name: label, type,
          fileUrl: `/uploads/documents/${app.applicantId}-${type}.pdf`,
          status: ['approved', 'under review', 'rejected'][Math.floor(Math.random() * 3)],
          applicantId: app.applicantId, applicationId: app._id, tenantId: app.tenantId,
        });
      }
    }
    await Document.insertMany(documentDocs);
    console.log(`${documentDocs.length} documents created`);

    // ---------- 9. BULK notifications (1-3 per student) ----------
    const notificationDocs = [];
    for (const student of insertedStudents) {
      const numNotifs = randomInRange(CONFIG.NOTIFS_PER_STUDENT);
      for (let i = 0; i < numNotifs; i++) {
        const t = NOTIF_TEMPLATES[Math.floor(Math.random() * NOTIF_TEMPLATES.length)];
        notificationDocs.push({
          tenantId: student.tenantId, userId: student._id,
          title: t.title, message: t.message, type: t.type,
          isRead: Math.random() > 0.5,
        });
      }
    }
    await Notification.insertMany(notificationDocs);
    console.log(`${notificationDocs.length} notifications created`);

    // ---------- 10. BULK audit logs (status-transition trail per application) ----------
    const auditLogDocs = [];
    for (const app of insertedApplications) {
      const changedBy = app.tenantId.equals(institution1._id) ? instAdmin1._id : instAdmin2._id;
      if (app.status === 'rejected') {
        auditLogDocs.push({ tenantId: app.tenantId, applicationId: app._id, fromStatus: 'submitted', toStatus: 'under_review', changedBy, remarks: 'Application moved to review' });
        auditLogDocs.push({ tenantId: app.tenantId, applicationId: app._id, fromStatus: 'under_review', toStatus: 'rejected', changedBy, remarks: 'Rejected - did not meet eligibility criteria' });
      } else {
        const finalIndex = STATUS_FLOW.indexOf(app.status);
        for (let i = 0; i < finalIndex; i++) {
          auditLogDocs.push({ tenantId: app.tenantId, applicationId: app._id, fromStatus: STATUS_FLOW[i], toStatus: STATUS_FLOW[i + 1], changedBy, remarks: `Moved to ${STATUS_FLOW[i + 1]}` });
        }
      }
    }
    await AuditLog.insertMany(auditLogDocs);
    console.log(`${auditLogDocs.length} audit logs created`);

    console.log('\n--- SEED SUMMARY ---');
    console.log(`Institutions: 2 | Students: ${insertedStudents.length} | Applications: ${insertedApplications.length}`);
    console.log(`Documents: ${documentDocs.length} | Notifications: ${notificationDocs.length} | Audit logs: ${auditLogDocs.length}`);
    console.log('\nLogin credentials (password for all: Test@123)');
    console.log('Super Admin :', superAdmin.email);
    console.log('VJTI Admin  :', instAdmin1.email);
    console.log('IITB Admin  :', instAdmin2.email);
    console.log('(600 dummy students at student0.vjti@test.scholarstack.com etc.)');

    process.exit(0);
  } catch (err) {
    console.error('Error seeding data:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
};

seedBulkData();