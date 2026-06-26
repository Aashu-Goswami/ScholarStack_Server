
/**
 * Dynamically classifies a student application based on:
 * - Academic Marks
 * - Course Eligibility Criteria
 * - Category
 * - Application/Documents Status
 */
const classifyApplication = (application) => {
    const tags = [];
    const course = application.courseId;
    const details = application.personalDetails || {};
    const documents = application.documents || [];

    // 1. Check Pending Verification
    const hasPendingDocs = documents.some(doc => doc.status === 'pending');
    if (hasPendingDocs || ['submitted', 'under_review'].includes(application.status)) {
        tags.push('Pending Verification');
    }

    // 2. Check Reserved Category
    if (details.category && details.category.toLowerCase() !== 'general') {
        tags.push('Reserved Category');
    }

    // 3. Check Eligibility & High Merit
    if (course && course.eligibilityCriteria) {
        const minMarksRequired = course.eligibilityCriteria.minMarks || 0;
        const meritThreshold = course.eligibilityCriteria.meritThreshold || 90;
        const studentMarks = details.academicMarks || 0;

        if (studentMarks >= minMarksRequired) {
            tags.push('Eligible');
            if (studentMarks >= meritThreshold) {
                tags.push('High Merit');
            }
        } else {
            tags.push('Not Eligible');
        }
    }

    return tags;
};

module.exports = {
    classifyApplication
};
