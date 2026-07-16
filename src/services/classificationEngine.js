// STUDENT CLASSIFICATION ENGINE
// DYNAMICALLY CLASSIFIES A STUDENT APPLICATION BASED ON - ACADEMIC MARKS, COURSE ELIGIBILITY CRITERIA AND CATEGORY 

const evaluateCriteria = (criteria, details) => {
    const {field, operator, value} = criteria;
    const actualValue = details[field];

    // CHECK IF FIELD EXISTS IN THE APPLICATION DATA
    if(actualValue === undefined || actualValue === null) {
        return {
            passed: false,
            reason: `Field ${field} is missing in application details`,
            actualValue: null
        };
    }

    // APPLY THE COMPARISON OPERATOR
    let passed = false;
    switch(operator) {
        case '>=':
            passed = actualValue >= value; break;
        case '<=':
            passed = actualValue <= value; break;
        case '>':
            passed = actualValue > value; break;
        case '<':
            passed = actualValue < value; break;
        case '==':
            passed = actualValue === value; break;
        default:
            passed = false;
    }

    return {
        passed,
        reason: passed ? '' : `Expected ${field} ${operator} ${value}, but got ${actualValue}`,
        actualValue
    };
};

// CLASSIFICATION FUNCTION - EVALUATES AN APPLICATION AGAINST ELIGIBILITY CRITERIA AND RETURNS RESULT
const classifyApplication = (application, rules = {}) => {

    // EXTRACT DATA
    const course = application.courseId || {};
    const details = application.personalDetails || {};
    const category = details.category || 'General';
    const reservedCategories = rules.reservedCategories || ['SC', 'ST', 'OBC', 'EWS'];
    const isReserved = reservedCategories.some(cat => cat.toLowerCase() === category.toLowerCase());

    // BUILD ELIGIBILITY CRITERIA 
    let criteria = [];

    // GET CRITERIA FROM COURSE
    if(course.eligibilityCriteria) {
        if(Array.isArray(course.eligibilityCriteria)) {
            criteria = course.eligibilityCriteria;
        } else {
            const minPercentage = course.eligibilityCriteria.minPercentage;
            if(minPercentage !== undefined) {
                criteria = [{field: 'twelfthPercentage', operator: '>=', value: minPercentage}];
            } 
        }
    }

    // OVER-RIDE WITH COURSE SPECIFIC RULES
    if(rules.courseSpecificRules && rules.courseSpecificRules[course._id]) {
        const courseRules = rules.courseSpecificRules[course._id];
        if(courseRules.criteria) {
            criteria = courseRules.criteria;
        }
        if(courseRules.highMeritThreshold !== undefined) {
            rules.highMeritThreshold = courseRules.highMeritThreshold;
        }
        if(courseRules.mediumMeritThreshold !== undefined) {
            rules.mediumMeritThreshold = courseRules.mediumMeritThreshold;
        }
    }

    // FALLBACK IF NO CRITERIA DEFINED
    if(criteria.length === 0) {
        const minMarks = rules.eligibilityMinMarks || 0;
        criteria = [{field: 'twelfthPercentage', operator: '>=', value: minMarks}];
    }

    // EVALUATE CRITERIA 
    const results = criteria.map(criterion => evaluateCriteria(criterion, details));
    const allPassed = results.every(result => result.passed);
    const failedReasons = results
        .filter(result => !result.passed)
        .map(result => result.reason)
        .join('; ');

    // COMPUTE MERIT SCORE
    let score = 0;
    const firstNumeric = criteria.find(criterion => details[criterion.field] !== undefined && details[criterion.field] !== null);
    if(firstNumeric) {
        score = parseFloat(details[firstNumeric.field]) || 0;
    } else {
        score = parseFloat(details.twelfthPercentage) || 
                parseFloat(details.graduationPercentage) || 
                parseFloat(details.academicMarks) || 0;
    }

    // DETERMINE MERIT LEVEL
    const highMeritThreshold = rules.highMeritThreshold || 90;
    const mediumMeritThreshold = rules.mediumMeritThreshold || 65;

    let meritLevel = 'Low Merit';
    if(allPassed && score >= highMeritThreshold) {
        meritLevel ='High Merit';
    } else if(allPassed && score >= mediumMeritThreshold) {
        meritLevel = 'Medium Merit';
    }

    // BUILD CLASSIFICATION MODEL
    const classification = {
        eligible: allPassed,
        meritLevel,
        category,
        isReserved,
        reasons: allPassed ? '' : `Ineligible: ${failedReasons}`,
        score : Math.round(score * 100) / 100,
        criteriaResults: results.map(result => ({
            field: result.field,
            actual: result.actualValue,
            passed: result.passed,
            reason: result.reason
        }))
    };

    return classification;
};

module.exports = { classifyApplication };
