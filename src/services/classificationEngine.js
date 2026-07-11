/**
 * Dynamically classifies a student application based on:
 * - Academic Marks
 * - Course Eligibility Criteria
 * - Category
 */

const evaluateCriteria = (criteria, details) => {
    const {field, operator, value} = criteria;
    const actualValue = details[field];

    if(actualValue === undefined || actualValue === null) {
        return {
            passed: false,
            reason: `Field ${field} is missing in application details`,
            actualValue: null
        };
    }

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

const classifyApplication = (application, rules = {}) => {
    const course = application.courseId || {};
    const details = application.personalDetails || {};
    const category = details.category || 'General';
    const reservedCategories = rules.reservedCategories || ['SC', 'ST', 'OBC', 'EWS'];
    const isReserved = reservedCategories.some(cat => cat.toLowerCase() === category.toLowerCase());

    let criteria = [];

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

    if(criteria.length === 0) {
        const minMarks = rules.eligibilityMinMarks || 0;
        criteria = [{field: 'twelfthPercentage', operator: '>=', value: minMarks}];
    }

    const results = criteria.map(criterion => evaluateCriteria(criterion, details));
    const allPassed = results.every(result => result.passed);
    const failedReasons = results
        .filter(result => !result.passed)
        .map(result => result.reason)
        .join('; ');

    let score = 0;
    const firstNumeric = criteria.find(criterion => details[criterion.field] === 'undefined');
    if(firstNumeric) {
        score = parseFloat(details[firstNumeric.field]) || 0;
    } else {
        score = parseFloat(details.twelfthPercentage) || 
                parseFloat(details.graduationPercentage) || 
                parseFloat(details.academicMarks) || 0;
    }

    const highMeritThreshold = rules.highMeritThreshold || 90;
    const mediumMeritThreshold = rules.mediumMeritThreshold || 65;

    let meritLevel = 'Low Merit';
    if(allPassed && score >= highMeritThreshold) {
        meritLevel ='High Merit';
    } else if(allPassed && score >= mediumMeritThreshold) {
        meritLevel = 'Medium Merit';
    }

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
