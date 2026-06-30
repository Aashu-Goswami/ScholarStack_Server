const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./src/config/db');
<<<<<<< HEAD
=======

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

>>>>>>> fdcbf1f35a0b364613173366e7f356c14779576e

// LOAD ENV VARIABLES
dotenv.config();

// CONNECT TO DATABASE
connectDB();

const app = express();

// MIDDLEWARE TO PARSE JSON
app.use(express.json());

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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
