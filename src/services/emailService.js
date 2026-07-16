// EMAIL SERVICE
// HANDLES EMAIL DELIVERY USING NODEMAILER WITH STMP, SUPPORTS DEVELOPMENT MODE AND PRODUCTION MODE

const nodemailer = require('nodemailer');
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.EMAIL_USER;

// SMTP TRNASPORTER INSTANCE
let transporter = null;

// CREATE TRANSPORTER ONLY IN PRODUCTION
if (!isDevelopment) {
    transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT) || 587,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
}

// SEND AN EMAIL
exports.sendEmail = async (options) => {
  
  // VALIDATE REQUIRED FIELDS
  if (!options.email) {
    throw new Error('Recipient email is required');
  }
  if (!options.subject) {
    throw new Error('Email subject is required');
  }
  if (!options.message) {
    throw new Error('Email message is required');
  }

  // DEVELOPMENT MODE - LOG EMAIL TO CONSOLE
  if (isDevelopment) {
    console.log('Email to Console (For Development Mode)');
    console.log('To:', options.email);
    console.log('Subject:', options.subject);
    console.log('Message:', options.message);
    return { success: true, devMode: true };
  }
    
  // PRODUCTION MODE - SEND EMAIL VIA SMTP
  if (!transporter) {
    throw new Error('Email transporter is not configured. Please check environment variables.');
  }

  const message = {
    from : `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
    to : options.email,
    subject : options.subject,
    text : options.message
  };
  
  try {
    const info = await transporter.sendMail(message);
    console.log(`Email send successfully to ${options.email}`);
  } catch (err) {
    throw new Error(`Failed to send email : ${err.message}`);
  }
};