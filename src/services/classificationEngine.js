/**
 * Dynamically classifies a student application based on:
 * - Academic Marks
 * - Course Eligibility Criteria
 * - Category
 */

const classifyApplication = (application, rules = {}, allApplications = []) => {
    // DEFAULT VALUES
    const {
        highMeritThreshold = 85,
        mediumMeritThreshold = 60,
        reservedCategories = ['SC', 'ST', 'OBC', 'EWS'],
        eligibilityMinMarks = 50,
        courseSpecificRules = {}
    } = rules;

    // DATA FROM APPLICATION
    const course = application.courseId || {}; 
    const details = application.personalDetails || {};
    const status = application.status || 'draft';

    // STUDENT DATA
    const studentMarks = details.academicMarks || 0;
    const studentCategory = details.category || 'General';
    const isReserved = reservedCategories.some( cat => cat.toLowerCase() === studentCategory.toLowerCase() );

    // 1. CHECK ELIGIBILITY
    let courseEligibilityMin = eligibilityMinMarks;
    if(course._id && courseSpecificRules[course._id]) {
        courseEligibilityMin = courseSpecificRules[course._id].minMarks || eligibilityMinMarks;
    }
    if(course.eligibilityCriteria && course.eligibilityCriteria.minMarks !== undefined) {
        courseEligibilityMin = course.eligibilityCriteria.minMarks;
    }

    const isEligible = studentMarks >= courseEligibilityMin;

    // 2. CALCULATE MERIT LEVEL
    let courseHighMeritThreshold = highMeritThreshold;
    let courseMediumMeritThreshold = mediumMeritThreshold;

    if(course._id && courseSpecificRules[course._id]) {
        courseHighMeritThreshold = courseSpecificRules[course._id].highMeritThreshold || highMeritThreshold;
        courseMediumMeritThreshold = courseSpecificRules[course._id].mediumMeritThreshold || mediumMeritThreshold;
    }

    let meritLevel = 'Low Merit';
    if(studentMarks >= courseHighMeritThreshold) {
        meritLevel = 'Hight Merit';
    } else if(studentMarks >= courseMediumMeritThreshold) {
        meritLevel = 'Medium Merit';
    }

    return {
        eligible : isEligible,
        meritLevel,
        category : studentCategory,
        isReserved
    };
};


module.exports = { classifyApplication };