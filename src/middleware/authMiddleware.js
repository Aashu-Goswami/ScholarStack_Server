// AUTHENTICATION MIDDLEWARE 
// PROVIDES JWT-BASED AUTHENTICATION FOR PROTECTED ROUTES.
// VERIFIES THE BEARER TOKEN, DECODES THE JWT AND ATTACHES THE USER OBJECT TO THE REQUEST.

const jwt = require('jsonwebtoken');
const User = require('../models/user');

// PROTECT MIDDLEWARE - AUTHENTICATES INCOMING REQUESTS
// USAGE - ADD 'protect' TO ANY ROUTE THAT REQUIRES AUTHENRICATION
exports.protect = async (req, res, next) => {
  let token;

  // EXTRACT TOKEN FROM AUTHORIZATION HEADER
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // CHECK IF TOKEN EXISTS
  if (!token) {
    return res.status(401).json({ 
        success : false,
        message : 'Not authorized, no token' 
    });
  }

  try {
    // VERIFY TOKEN AND FIND USER BY ID FROM THE TOKEN
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-passwordHash');

    // CHECK IF THE USER STILL EXISTS IN DATABASE
    if (!user) {
      return res.status(401).json({ 
        success : false,
        message : 'User not found' 
      });
    }

    // ATTACH USER TO REQUEST
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ 
        success : false,
        message : err.message 
    });
  }
};
