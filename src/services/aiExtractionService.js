// AI DOCUMENT EXTRACTION SERVICE
// ---------------------------------------------------------------------------
// Extracts text from an uploaded student document (PDF or image), then sends
// that text to Groq to extract structured application-form data (name, dob,
// marks, etc.) as strict JSON.
//
// Requires GROQ_API_KEY in .env. Get one from https://console.groq.com/keys
//
// PDF HANDLING (pdf-parse v2 API):
//   `pdf-parse` v2+ is a full rewrite: it's no longer a callable function,
//   it's a `PDFParse` class with methods (getText, getScreenshot, getInfo,
//   destroy, ...). It bundles its own pdf.js internally and can render pages
//   to PNG buffers via getScreenshot() using @napi-rs/canvas (an optional
//   dependency of pdf-parse) — no pdf2pic, no separate pdfjs-dist usage, no
//   GraphicsMagick/Ghostscript needed.
//
//   Flow per PDF:
//     1. getText() -> native/embedded text layer, judged with a per-page
//        density check to classify digital vs. scanned/hybrid.
//     2. If scanned/hybrid: getScreenshot() renders every page to a PNG
//        buffer using the SAME parser instance (no re-parsing the PDF), then
//        each page image is OCR'd with Tesseract.js and merged.
//
// Images (PNG/JPG/JPEG) are OCR'd directly via Tesseract.js, unchanged.
// ---------------------------------------------------------------------------

const Groq = require("groq-sdk");
const { PDFParse } = require("pdf-parse");
const Tesseract = require("tesseract.js");

// ---------------------------------------------------------------------------
// CONFIG / CONSTANTS
// ---------------------------------------------------------------------------

// MIME types this service knows how to handle. Anything else is rejected
// up front with a clear 400, instead of failing deep inside pdf-parse/Tesseract.
const SUPPORTED_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']);

// Minimum average characters-per-page for a PDF to be considered "text-based".
// Using a per-page density instead of a single global character count avoids
// misclassifying hybrid PDFs (e.g. a typed cover page + scanned marksheet).
const MIN_CHARS_PER_PAGE = 40;

// Render resolution (pdf-parse's getScreenshot `scale` option) for scanned
// pages before OCR. Higher improves OCR accuracy at the cost of speed/memory.
const PDF_RENDER_SCALE = 2.0;

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

// Small logging helper so extraction failures are traceable in production
// logs (Render/Railway) without leaking sensitive document content.
function log(level, message, meta) {
    const line = `[aiExtractionService] ${message}`;
    if (meta !== undefined) {
        // eslint-disable-next-line no-console
        console[level === 'error' ? 'error' : 'log'](line, meta);
    } else {
        // eslint-disable-next-line no-console
        console[level === 'error' ? 'error' : 'log'](line);
    }
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

// ---------------------------------------------------------------------------
// MIME TYPE VALIDATION
// ---------------------------------------------------------------------------

/**
 * Validates that the uploaded file's mimetype is one this service supports.
 * Throws a 400 error immediately instead of letting an unsupported type fail
 * deep inside pdf-parse or Tesseract with a confusing stack trace.
 * @param {string} mimetype
 */
function assertSupportedMimeType(mimetype) {
    if (!mimetype || !SUPPORTED_MIME_TYPES.has(mimetype)) {
        const err = new Error(
            `Unsupported file type "${mimetype || 'unknown'}". Please upload a PDF, PNG, or JPG.`
        );
        err.statusCode = 400;
        throw err;
    }
}

/**
 * Decides whether a PDF's native text layer is "good enough" to treat it as
 * a text-based PDF, using a per-page density check rather than one global
 * character count. This correctly handles hybrid PDFs (some pages typed,
 * some scanned).
 * @param {string} text
 * @param {number} numpages
 * @returns {boolean}
 */
function isTextBasedPdf(text, numpages) {
    if (!text || text.length === 0) return false;
    const pages = numpages > 0 ? numpages : 1;
    const avgCharsPerPage = text.length / pages;
    return avgCharsPerPage >= MIN_CHARS_PER_PAGE;
}

// ---------------------------------------------------------------------------
// OCR (Tesseract.js) — images and rendered scanned-PDF pages
// ---------------------------------------------------------------------------

/**
 * Runs Tesseract.js OCR over a single image buffer (PNG/JPG) and returns the
 * recognized text. Never pass a PDF buffer to this function — Tesseract only
 * understands raster images.
 * @param {Buffer|Uint8Array} imageBuffer - raw image bytes (not a PDF)
 * @returns {Promise<string>}
 */
async function ocrImage(imageBuffer) {
    const {
        data: { text },
    } = await Tesseract.recognize(imageBuffer, 'eng');
    return text || '';
}

/**
 * OCRs every rendered page image and merges the results in page order.
 * Pages that fail OCR are skipped (logged) rather than aborting the whole
 * document, so a single bad page doesn't block an otherwise-readable file.
 * @param {Array<{ data: Uint8Array }>} screenshotPages - pdf-parse getScreenshot() pages
 * @returns {Promise<string>}
 */
async function ocrPdfPageImages(screenshotPages) {
    const pageTexts = [];

    for (let i = 0; i < screenshotPages.length; i += 1) {
        try {
            const pageBuffer = Buffer.from(screenshotPages[i].data);
            const pageText = await ocrImage(pageBuffer);
            if (pageText.trim()) {
                pageTexts.push(pageText);
            }
        } catch (e) {
            log('error', `OCR failed on PDF page ${i + 1}, skipping page`, { message: e.message });
        }
    }

    return pageTexts.join('\n\n');
}

// ---------------------------------------------------------------------------
// PDF TEXT EXTRACTION (native text via pdf-parse, OCR fallback via pdf-parse
// screenshots + Tesseract) — single parser instance reused for both steps.
// ---------------------------------------------------------------------------

/**
 * Extracts text from a PDF buffer:
 * - Loads the PDF once via pdf-parse's PDFParse class.
 * - Tries the native text layer first (getText), judged by per-page density.
 * - Falls back to rendering every page to a PNG (getScreenshot) and OCR'ing
 *   each page with Tesseract.js, reusing the same parser/PDF load.
 * @param {Buffer} buffer - raw PDF bytes
 * @returns {Promise<string>}
 */
async function extractTextFromPdf(buffer) {
    const parser = new PDFParse({ data: buffer });

    try {
        let textResult;
        try {
            textResult = await parser.getText();
        } catch (e) {
            log('error', 'pdf-parse getText() failed', { message: e.message });
            const err = new Error(
                'This PDF could not be processed. It may be corrupted or password-protected. ' +
                'Please upload a valid PDF or an image (PNG/JPG).'
            );
            err.statusCode = 422;
            throw err;
        }

        const numpages = textResult.total || (textResult.pages ? textResult.pages.length : 1);
        // Build from per-page text rather than the combined `.text` field,
        // which includes "-- X of Y --" page-separator noise.
        const nativeText = Array.isArray(textResult.pages) && textResult.pages.length > 0
            ? textResult.pages.map((p) => p.text || '').join('\n\n').trim()
            : (textResult.text || '').trim();

        if (isTextBasedPdf(nativeText, numpages)) {
            log('info', 'PDF classified as text-based, using native text layer', {
                numpages,
                chars: nativeText.length,
            });
            return nativeText;
        }

        // Low/no native text density -> scanned or hybrid PDF. Render every
        // page to an image (via pdf-parse's built-in getScreenshot) and OCR
        // each one with Tesseract.js.
        log('info', 'PDF classified as scanned/hybrid, falling back to render+OCR', {
            numpages,
            chars: nativeText.length,
        });

        let screenshot;
        try {
            screenshot = await parser.getScreenshot({ scale: PDF_RENDER_SCALE });
        } catch (e) {
            log('error', 'pdf-parse getScreenshot() failed', { message: e.message });
            const err = new Error(
                'This PDF could not be rendered for OCR. It may be corrupted or password-protected. ' +
                'Please upload a valid PDF or an image (PNG/JPG).'
            );
            err.statusCode = 422;
            throw err;
        }

        const pages = screenshot && Array.isArray(screenshot.pages) ? screenshot.pages : [];

        if (pages.length === 0) {
            const err = new Error(
                'This PDF could not be read (no pages found). Please upload a valid PDF or an image (PNG/JPG).'
            );
            err.statusCode = 422;
            throw err;
        }

        const ocrText = await ocrPdfPageImages(pages);

        if (!ocrText || ocrText.trim().length === 0) {
            const err = new Error(
                'Could not extract any readable text from this PDF, even with OCR. ' +
                'Please upload a clearer scan or a different document.'
            );
            err.statusCode = 422;
            throw err;
        }

        return ocrText;
    } finally {
        // Always release the parser's internal resources, even on failure.
        await parser.destroy();
    }
}

// ---------------------------------------------------------------------------
// DOCUMENT TEXT EXTRACTION (top-level router)
// ---------------------------------------------------------------------------

/**
 * Extracts raw text from the uploaded document, routing to the appropriate
 * strategy based on mimetype.
 * - PDFs: native text layer first, OCR-of-rendered-pages fallback (see
 *   extractTextFromPdf).
 * - Images (PNG/JPG/JPEG): OCR'd directly via Tesseract.js.
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @returns {Promise<string>}
 */
async function extractTextFromDocument(buffer, mimetype) {
    if (mimetype === 'application/pdf') {
        return extractTextFromPdf(buffer);
    }

    // Images: png, jpg, jpeg — OCR directly. Never a PDF buffer here.
    return ocrImage(buffer);
}

// ---------------------------------------------------------------------------
// PUBLIC API (unchanged signature/behavior for routes/controllers/frontend)
// ---------------------------------------------------------------------------

/**
 * Extracts application-form field values from an uploaded document.
 * @param {Buffer} buffer - raw file bytes (from multer memory storage)
 * @param {string} mimetype - 'application/pdf' | 'image/png' | 'image/jpeg'
 * @param {Array} [templateFields] - optional FormTemplate.fields to target
 *   institution-specific fieldKeys instead of the generic field set.
 * @returns {Promise<{ extractedFields: object, fieldsAttempted: string[] }>}
 */
async function extractApplicationFields(buffer, mimetype, templateFields) {
    // Validate mimetype up front — fail fast with a clear 400 instead of a
    // confusing error deep inside pdf-parse/Tesseract for unsupported types.
    assertSupportedMimeType(mimetype);

    const client = getClient();
    const fields = buildFieldList(templateFields);
    const prompt = buildPrompt(fields);

    // Step 1: get raw text out of the document (native PDF text, rendered
    // PDF page OCR, or direct image OCR).
    const documentText = await extractTextFromDocument(buffer, mimetype);

    if (!documentText || documentText.trim().length === 0) {
        const err = new Error('Could not read any text from the document. Please fill the form manually.');
        err.statusCode = 422;
        throw err;
    }

    // Step 2: send the extracted text + field instructions to Groq.
    // (Groq pipeline unchanged from the previous implementation.)
    const fullPrompt = `${prompt}

Here is the text extracted (via OCR/PDF parsing) from the uploaded document. It may contain \
OCR noise or formatting artifacts — use your best judgment to identify the correct values, \
but never invent data that isn't actually present in the text below. If a field's value isn't \
clearly present, omit that key entirely.

--- BEGIN DOCUMENT TEXT ---
${documentText}
--- END DOCUMENT TEXT ---

Respond with ONLY valid JSON, no markdown, no code fences, no commentary.`;

    let completion;
    try {
        completion = await client.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                {
                    role: 'user',
                    content: fullPrompt,
                },
            ],
        });
    } catch (e) {
        log('error', 'Groq API call failed', { message: e.message });
        const err = new Error('AI extraction service is temporarily unavailable. Please try again shortly.');
        err.statusCode = 502;
        throw err;
    }

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
        log('error', 'Failed to parse Groq JSON response', { message: parseErr.message });
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