const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('./src/config/db');

// IMPORT ROUTERS
const authRoutes = require('./src/routes/auth');
const institutionRoutes = require('./src/routes/institutions');
const courseRoutes = require('./src/routes/courses');
const documentRoutes = require('./src/routes/documents');
const applicationRoutes = require('./src/routes/applications');
const notificationRoutes = require('./src/routes/notifications');
const formRoutes = require('./src/routes/forms');
const dashboardRoutes = require('./src/routes/dashboard');
const classificationRoutes = require('./src/routes/classification');

// LOAD ENVIRONMENT VARIABLES
dotenv.config();

// CONNECT TO DATABASE
connectDB();

// EXPRESS APP INITIALIZATION
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin : process.env.NODE_ENV === 'production'
        ? process.env.FRONTEND_URL || 'https://scholarstack.com'
        : '*',
    credentials : true
}));

// MIDDLEWARE TO PARSE JSON
app.use(express.json({ limit : '10mb'}));
app.use(express.urlencoded({ extended : true, limit : '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'src', 'uploads')));

// REGISTER API ROUTERS
app.use('/api/auth', authRoutes);
app.use('/api/institutions', institutionRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/classifications', classificationRoutes);

// TEST ROUTE
app.get('/', (req, res) => {
    res.send('ScholarStack API is running...');
});

// ERROR HANDLING
app.use((err, req, res, next) => {
    console.error('Error : ', err.stack);

    // HANDLE MULTER ERRORS
    if(err.name == 'MulterError') {
        return res.status(400).json({
            success : false,
            message : err.message
        });
    }

    // HANDLE MONGOOSE VALIDATION ERRORS
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({
            success: false,
            message: messages.join(', ')
        });
    }

    // HANDLE DUPLICATE KEY ERRORS
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(400).json({
            success: false,
            message: `Duplicate value for field: ${field}`
        });
    }

    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// START SERVER
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// GRACEFUL SHUTDOWN ON PROCESS TERMINATION
const gracefulShutdown = (signal) => {
    console.log(`\n Received ${signal}. Shutting down...`);

    server.close(async (err) => {
        if (err) {
            console.error('Error closing server:', err);
            process.exit(1);
        }

        console.log('HTTP server closed.');

        try {
            await mongoose.connection.close(false);
            console.log('MongoDB connection closed.');
            process.exit(0);
        } catch (err) {
            console.error('Error closing MongoDB:', err);
            process.exit(1);
        }
    });

    // FORCE SHUT DOWN AFTER 10 SECONDS
    setTimeout(() => {
        console.error('Force closing due to timeout...');
        process.exit(1);
    }, 10000);
};

// SHUT DOWN HANDLERS
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    gracefulShutdown('uncaughtException');
});
