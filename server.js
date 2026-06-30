const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./src/config/db');

// LOAD ENV VARIABLES
dotenv.config();

// CONNECT TO DATABASE
connectDB();

const app = express();

// MIDDLEWARE TO PARSE JSON
app.use(express.json());

// TEST ROUTE
app.get('/', (req, res) => {
    res.send('ScholarStack API is running...');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
