const nodemailer = require('nodemailer');
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.EMAIL_USER;

let transporter = null;
if (!isDevelopment) {
    transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
}

exports.sendEmail = async (options) => {
  if (isDevelopment) {
    console.log('Email to Console (For Development Mode)');
    console.log('To:', options.email);
    console.log('Subject:', options.subject);
    console.log('Message:', options.message);
    return { success: true, devMode: true };
  }
    
  const message = {
    from : `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
    to : options.email,
    subject : options.subject,
    text : options.message
  };
  await transporter.sendMail(message);
};