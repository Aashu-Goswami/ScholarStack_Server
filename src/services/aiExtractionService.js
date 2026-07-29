// AI DOCUMENT EXTRACTION SERVICE
// EXTRACTS TEXT FROM AN UPLOADED DOCUMENT (IMAGE OR PDF) VIA OCR, THEN SENDS
// THAT TEXT TO GROQ AND ASKS IT TO EXTRACT STRUCTURED APPLICATION-FORM DATA
// (NAME, DOB, MARKS, ETC.) AS STRICT JSON.
//
// Requires GROQ_API_KEY in .env. Get one from https://console.groq.com/keys
//
// IMPORTANT: Tesseract.js can only OCR raster images (PNG/JPG buffers), it
// cannot read PDF files directly. For scanned/image-only PDFs we first
// rasterize each page to an image using pdf2pic, then OCR each page image.

const Groq = require("groq-sdk");
const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");
const { fromBuffer } = require("pdf2pic");

let groqClient = null;

function getClient() {
    if (!process.env.GROQ_API_KEY) {
        const err = new Error("AI extraction is not configured (missing GROQ_API_KEY).");
        err.statusCode = 503;
        throw err;
    }

    if (!groqClient) {
        groqClient = new Groq({
            apiKey: process.env.GROQ_API_KEY,
        });
    }

    return groqClient;
}

// GENERIC FIELD SET — MATCHES THE CURRENT (STATIC) STUDENT APPLICATION FORM.
// Used when no course-specific form template is supplied.
const GENERIC_FIELDS = [
    { fieldKey: 'firstName', label: 'First name', type: 'text' },
    { fieldKey: 'lastName', label: 'Last name', type: 'text' },
    { fieldKey: 'dob', label: 'Date of birth (YYYY-MM-DD)', type: 'date' },
    { fieldKey: 'stream', label: 'Stream / subject specialization', type: 'text' },
    { fieldKey: 'percentage', label: 'Marksheet percentage (numeric, no % sign)', type: 'number' },
    { fieldKey: 'category', label: 'Reservation category — one of: general, obc, sc_st', type: 'text' },
];

function buildFieldList(templateFields) {
    if (Array.isArray(templateFields) && templateFields.length > 0) {
        return templateFields
            .filter((f) => f.type !== 'file') // file fields aren't extractable text data
            .map((f) => ({ fieldKey: f.fieldKey, label: f.label, type: f.type }));
    }
    return GENERIC_FIELDS;
}

function buildPrompt(fields) {
    const fieldDescriptions = fields
        .map((f) => `- "${f.fieldKey}" (${f.type}): ${f.label}`)
        .join('\n');

    return `You are a document-data-extraction assistant for a college admissions platform. \
A student has uploaded a document (e.g. a marksheet, certificate, or ID proof) as part of an \
application form. Read the document and extract values for the following fields, if present:

${fieldDescriptions}

Rules:
- Respond with ONLY a single JSON object — no markdown, no code fences, no commentary.
- Use exactly these field keys: ${fields.map((f) => `"${f.fieldKey}"`).join(', ')}.
- If a field's value cannot be confidently found in the document, omit that key entirely \
(do not guess or invent data).
- Dates must be formatted as YYYY-MM-DD.
- Numeric fields (like percentage) must be plain numbers as strings, no "%" symbol.
- Do not include any field not in the list above.`;
}

// Strips accidental markdown code fences before JSON.parse, in case the
// model wraps its answer despite instructions not to.
function extractJson(text) {
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) {
        throw new Error('Model did not return a JSON object');
    }
    return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * Attempts to extract embedded/native text from a PDF buffer using pdf-parse.
 * Works for digitally-generated PDFs (e.g. exported from Word, LaTeX, etc.)
 * but returns little or no text for scanned/image-only PDFs.
 * @param {Buffer} buffer - raw PDF bytes
 * @returns {Promise<string>} extracted text, or '' on failure
 */
async function extractPdfText(buffer) {
    try {
        const parsed = await pdfParse(buffer);
        return (parsed.text || '').trim();
    } catch (e) {
        // Malformed / non-standard PDF — treat as no native text, let the
        // caller fall back to OCR.
        return '';
    }
}

/**
 * Rasterizes every page of a PDF buffer into an image buffer using pdf2pic.
 * This is required because Tesseract.js cannot read PDF files directly —
 * it only understands raster images (PNG/JPEG/etc).
 * @param {Buffer} buffer - raw PDF bytes
 * @returns {Promise<Buffer[]>} array of page image buffers, in page order
 */
async function convertPdfToImages(buffer) {
    const convert = fromBuffer(buffer, {
        density: 200,        // DPI — higher improves OCR accuracy at the cost of speed
        format: 'png',
        width: 1654,          // ~200 DPI for an A4 page
        height: 2339,
    });

    // -1 tells pdf2pic to convert ALL pages of the document.
    const pages = await convert.bulk(-1, { responseType: 'buffer' });

    return pages
        .map((page) => page.buffer)
        .filter((pageBuffer) => Buffer.isBuffer(pageBuffer) && pageBuffer.length > 0);
}

/**
 * Runs Tesseract.js OCR over a single image buffer (PNG/JPG) and returns
 * the recognized text. Never pass a PDF buffer to this function.
 * @param {Buffer} imageBuffer - raw image bytes (not a PDF)
 * @returns {Promise<string>}
 */
async function ocrImage(imageBuffer) {
    const {
        data: { text },
    } = await Tesseract.recognize(imageBuffer, 'eng');
    return text || '';
}

/**
 * Extracts raw text from the uploaded document.
 * - PDFs: try pdf-parse first (fast, works for text-based/digital PDFs).
 *   If the extracted text is empty or too short (<20 chars), the PDF is
 *   likely scanned/image-only, so every page is rasterized to an image via
 *   pdf2pic and OCR'd individually with Tesseract.js. All page text is
 *   merged together in page order.
 * - Images (PNG/JPG/JPEG): OCR'd directly via Tesseract.js.
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @returns {Promise<string>}
 */
async function extractTextFromDocument(buffer, mimetype) {
    if (mimetype === 'application/pdf') {
        const pdfText = await extractPdfText(buffer);

        if (pdfText.length > 20) {
            return pdfText;
        }

        // Native text extraction was empty or too small — likely a scanned
        // PDF. Rasterize each page to an image, then OCR each page image.
        const pageImages = await convertPdfToImages(buffer);

        if (pageImages.length === 0) {
            // Could not rasterize any pages — nothing left to try.
            return '';
        }

        const pageTexts = [];
        for (const pageImageBuffer of pageImages) {
            const pageText = await ocrImage(pageImageBuffer);
            if (pageText) {
                pageTexts.push(pageText);
            }
        }

        return pageTexts.join('\n\n');
    }

    // Images: png, jpg, jpeg — OCR directly. Never a PDF buffer here.
    return ocrImage(buffer);
}

/**
 * Extracts application-form field values from an uploaded document.
 * @param {Buffer} buffer - raw file bytes (from multer memory storage)
 * @param {string} mimetype - 'application/pdf' | 'image/png' | 'image/jpeg'
 * @param {Array} [templateFields] - optional FormTemplate.fields to target
 *   institution-specific fieldKeys instead of the generic field set.
 * @returns {Promise<{ extractedFields: object, fieldsAttempted: string[] }>}
 */
async function extractApplicationFields(buffer, mimetype, templateFields) {
    const client = getClient();
    const fields = buildFieldList(templateFields);
    const prompt = buildPrompt(fields);

    // Step 1: get raw text out of the document (native PDF text, or OCR).
    const documentText = await extractTextFromDocument(buffer, mimetype);

    if (!documentText || documentText.trim().length === 0) {
        const err = new Error('Could not read any text from the document. Please fill the form manually.');
        err.statusCode = 422;
        throw err;
    }

    // Step 2: send the extracted text + field instructions to Groq.
    const fullPrompt = `${prompt}

Here is the text extracted (via OCR/PDF parsing) from the uploaded document. It may contain \
OCR noise or formatting artifacts — use your best judgment to identify the correct values, \
but never invent data that isn't actually present in the text below. If a field's value isn't \
clearly present, omit that key entirely.

--- BEGIN DOCUMENT TEXT ---
${documentText}
--- END DOCUMENT TEXT ---

Respond with ONLY valid JSON, no markdown, no code fences, no commentary.`;

    const completion = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
            {
                role: 'user',
                content: fullPrompt,
            },
        ],
    });

    const responseText = completion.choices && completion.choices[0] && completion.choices[0].message
        ? completion.choices[0].message.content
        : null;

    if (!responseText) {
        const err = new Error('AI extraction returned no readable response');
        err.statusCode = 502;
        throw err;
    }

    let extractedFields;
    try {
        extractedFields = extractJson(responseText);
    } catch (parseErr) {
        const err = new Error('Could not parse extracted data from the document. Please fill the form manually.');
        err.statusCode = 422;
        throw err;
    }

    // Keep only keys we actually asked for — defensive against the model
    // adding extra fields despite instructions.
    const allowedKeys = new Set(fields.map((f) => f.fieldKey));
    const filtered = Object.fromEntries(
        Object.entries(extractedFields).filter(([k, v]) => allowedKeys.has(k) && v !== null && v !== '')
    );

    return {
        extractedFields: filtered,
        fieldsAttempted: fields.map((f) => f.fieldKey),
    };
}

module.exports = { extractApplicationFields };