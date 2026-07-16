// THIS MODULE ESTABLISHES A CONNECTION TO MONGODB USING MOONGOOSE ODM.
// IT HANDLES CONNECTION RETRIES AND ERROR LOGGING.

const mongoose = require('mongoose');

// ESTABLISH A CONNECTION TO THE MONGODB DATABASE
const connectDB = async () => {
    try{
        // VALIDATE ENVIRONMENT VARIABLE EXISTS
        const mongoURI = process.env.MONGO_URI;
        if(!mongoURI) {
            console.error('MONGO_URI is not defined in environment variables');
            process.exit(1);
        }

        // CONNECTION OPTIONS - SERVER SELECTION TIMEOUT = 5 SEC, SOCKET TIMEOUT = 45 SEC, AND IPV4 FAMILY
        const options = {
            serverSelectionTimeoutMS: 5000, // HOW LONG TO WAIT FOR SERVER
            socketTimeoutMS: 45000, // HOW LONG TO WAIT FOR RESPONSE
            family: 4, // USE IPv4 SKIP IPv6
        }

        // ESTABLISH CONNECTION WITH OPTIONS
        const conn = await mongoose.connect(mongoURI, options);

        console.log(`MongoDB Connected: ${conn.connection.host}`);
        console.log(`MongoDB Database: ${conn.connection.name}`);
        console.log(`Connection State: ${conn.connection.readyState == 1 ? 'Connected' : 'Disconnected'}`);

        return conn;
    } catch (err) {
        console.error(`Error connecting to MongoDB: ${err.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
