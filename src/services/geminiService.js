const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;

const getGenAI = () => {
    if (!genAI) {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is not defined in the environment variables.');
        }
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return genAI;
};

/**
 * Generates personalized email and in-app message using Gemini 3.5 Flash
 */
const generateApplicationUpdateMessage = async ({
    studentName,
    courseName,
    status,
    remarks
}) => {
    try {
        const model = getGenAI().getGenerativeModel({ model: 'gemini-3.5-flash-lite' });

        const prompt = `
        You are an academic admissions assistant. Generate a professional and personalized email and in-app notification to a student about their application status update.

        Details:
        - Student Name: ${studentName}
        - Course Applied: ${courseName}
        - New Application Status: ${status}
        - Admin Reviewer Remarks: ${remarks || 'None provided'}

        Generate a response in JSON format matching this exact schema:
        {
          "emailSubject": "string (professional subject line)",
          "emailMessage": "string (personalized body, keep it professional and polite)",
          "notificationMessage": "string (short in-app notification message, max 150 chars)"
        }

        Do not wrap the JSON output in markdown formatting (like \`\`\`json). Return raw JSON only.
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        return JSON.parse(text);
    } catch (err) {
        console.error('Gemini Service Error:', err.message);
        throw new Error('Failed to generate AI message: ' + err.message);
    }
};

module.exports = { generateApplicationUpdateMessage };
