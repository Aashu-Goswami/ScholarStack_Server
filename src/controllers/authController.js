const User = require('../models/user');
const Institution = require('../models/institution');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendEmail } = require('../services/emailService');
const { triggerNotification } = require('../services/notificationServices');

// HELPER FUNCTION TO GENERATE TOKEN
const generateToken = (userId, role, tenantId) => {
    return jwt.sign(
        { id : userId, role, tenantId },
        process.env.JWT_SECRET,
        { expiresIn : process.env.JWT_EXPIRES_IN || '30d' }

    );
};

// HELPER FUNCTION TO RESOLVE TENANT FROM SUBDOMAIN
const resolveTenant = async (req) => {
    const host = req.headers.host;

    // GET SUBDOMAIN FROM THE HOST
    const hostname = host.split(':')[0];
    const subdomain = hostname.split('.')[0];

    if(subdomain === 'localhost' || subdomain === 'scholarstack' || subdomain === 'www' || subdomain === '127.0.0.1' || subdomain === 'super') {
        // DEFAULT TENANT ID FOR DEVELOPMENT
        if(process.env.DEFAULT_TENANT_ID) {
            return process.env.DEFAULT_TENANT_ID;
        }

        // NO TENANT - FOR SUPER ADMIN ROUTES
        return null;
    }

    // SUBDOMAIN FROM THE DATABASE
    const institution = await Institution.findOne({ subdomain }).select('_id');
    if(!institution) {
        throw new Error('Invalid Tenant Subdomain');
    }
    return institution._id;
};

// REGISTER A NEW STUDENT FUNCTION 
const registerStudent = async (req, res) => {
    try {
        // GET NAME, EMAIL, PASSWORD FROM REQUEST
        const { name, email, password } = req.body;
        if(!name || !email || !password) {
            return res.status(400).json({
                success : false,
                message : 'Please provide name, email and password'
            });
        }

        // RESOLVE TENANT FROM SUBDOMAIN
        let tenantId;
        try {
            tenantId = await resolveTenant(req);
            if(!tenantId) {
                return res.status(400).json({
                    success : false,
                    message : 'Invalid Institution subdomain'
                });
            }
        } catch (err) {
            return res.status(400).json({
                success : false,
                message : err.message
            });
        }

        // CHECK IF USER ALREADY EXISTS IN THIS TENANT
        const existingUser = await User.findOne({ email, tenantId });
        if(existingUser) {
            return res.status(400).json({
                success : false,
                message : 'user already registered under this institution'
            });
        }

        // HASH PASSWORD BEFORE STORING
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // CREATE A NEW STUDENT 
        const user = await User.create({
            name,
            email,
            passwordHash : hashedPassword,
            role : 'student',
            tenantId,
            isEmailVerified : true
        });

        // Trigger Registration Success Notification (In-app and Email)
        await triggerNotification({
            recipient: user._id,
            message: 'Your registration with ScholarStack was successful!',
            type: 'registration',
            tenantId,
            email: user.email,
            emailSubject: 'Welcome to ScholarStack - Registration Successful',
            emailMessage: `Hi ${user.name},\n\nYour account has been registered successfully on our admissions portal.\n\nYou can now log in, configure your profile, and start your course applications.\n\nBest regards,\nAdmissions Team`
        });

        const token = generateToken(user._id, user.role, user.tenantId);
        
        res.status(201).json({
            success : true,
            token,
            user : {
                id : user._id,
                name : user.name,
                email : user.email,
                role : user.role,
            }
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// LOGIN FUNCTION 
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if(!email || !password) {
            return res.status(400).json({
                success : false,
                message : 'Please provide email and password'
            });
        }

        // RESOLVE TENANT - FOR STUDENTS AND INSTITUTION ADMINS
        let user = await User.findOne({ email, role : 'superAdmin' });
        let tenantId = null;
        
        if(!user) {
            try {
                tenantId = await resolveTenant(req);
            } catch (err) {
            
                // IF TENANT RESOLUTION FAILS, IT MIGHT BE SUPER ADMIN
                const host = req.headers.host;
                const hostname = host ? host.split(':')[0] : '';
                const subdomain = hostname ? hostname.split('.')[0] : '';

                if(subdomain !== 'super') {
                    return res.status(400).json({
                        success : false,
                        message : 'Invalid Tenant'
                    });
                }
                tenantId = null; 
            // FOR SUPER ADMIN, TENANT ID REMAINS NULL
            }

            // FIND USER - SUPER ADMIN CAN LOGIN WITHOUT TENANT ID
            if(tenantId) {
                user = await User.findOne({ email, tenantId });
            } else {
                user = await User.findOne({ email, role : 'superAdmin' })
            }
        }

        if(!user) {
            return res.status(401).json({
                success : false,
                message : 'Invalid Credentials'
            });
        }

        // CHECK PASSWORD
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if(!isMatch) {
            return res.status(401).json({
                success : false,
                message : 'Invalid Credentials'
            });
        }

        // EMAIL VERIFICATION - FOR INSTITUTION ADMINS
        if(user.role === 'instAdmin' && !user.isEmailVerified) {
            return res.status(401).json({
                success : false,
                message : 'Please verify your email before logging in'
            });
        }

        const token = generateToken(user._id, user.role, user.tenantId || null); 
        res.status(200).json({
            success : true,
            token,
            user : {
                id : user._id,
                name : user.name,
                email : user.email,
                role : user.role,
                tenantId : user.tenantId
            }
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// FORGOT PASSWORD FUCNTION - SEND RESET TOKEN VIA EMAIL
const forgotPassword = async (req, res) => {
    try {
        // GET TENANT USING IT'S ID
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email'
            });
        }

        let user = await User.findOne({ email, role : 'superAdmin' });
        let tenantId = null;

        if(!user) {
            try {
                tenantId = await resolveTenant(req);
            } catch (err) {
                return res.status(400).json({ 
                    success : false, 
                    message : 'Invalid institution subdomain' 
                });
            }

            // FIND USER WITH THE TENANT ID AND SPECIFIC EMAIL
            if(tenantId) {
                user = await User.findOne({ email, tenantId });
            } else {
                user = await User.findOne({ email, role : 'superAdmin' });
            }
        }

        if(!user) {
            return res.status(404).json({
                success : false,
                message : 'No user found with that email'
            });
        }

        // GENERATE RESET TOKEN AND SET TOKEN EXPIRE TIMER
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
        await user.save();

        // SEND EMAIL
        const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;
        const message = `You requested a password reset. Please go to: ${resetUrl}`;

        try{
            await sendEmail({
                email : user.email,
                subject : 'Password Reset Request',
                message,
            });
            res.status(200).json({
                success : true,
                message : 'Email Sent'
            });
        } catch (err) {
            user.resetPasswordToken = undefined,
            user.resetPasswordExpire = undefined,
            await user.save();

            return res.status(500).json({
                success : false,
                message : 'Email could not be sent'
            });
        }
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// RESET PASSWORD FUNCTION - USING TOKEN
const resetPassword = async (req, res) => {
    try {
        // CREATE NEW TOKEN USING EXISTING TOKEN
        const { token, newPassword } = req.body;
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken : hashedToken,
            resetPasswordExpire : { $gt : Date.now() }
        });

        if(!user) {
            return res.status(400).json({
                success : false,
                message : 'Invalid or Expired Token'
            });
        }

        // UPDATE PASSWORD
        const salt = await bcrypt.genSalt(10);
        user.passwordHash = await bcrypt.hash(newPassword, salt);
        user.resetPasswordToken = undefined,
        user.resetPasswordExpire = undefined,
        await user.save();

        res.status(200).json({
            success : true,
            message : 'Password Updated Successfully'
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// VERIFY EMAIL FUNCTION - FOR INSTITUTION ADMIN ONLY
const verifyEmail = async (req, res) => {
    try {
        // GENERATE NEW TOKEN 
        const { token } = req.params;
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            emailVerificationToken : hashedToken,
            emailVerificationExpire : { $gt : Date.now() }
        });

        if(!user) {
            return res.status(404).json({
                success : false,
                message : 'Invalid or Expired verification link'
            });
        }

        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpire = undefined;
        await user.save();

        res.status(200).json({
            success : true,
            message : 'Email verified successfully'
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// CHANGE PASSWORD FUNCTION - FOR AUTHENTICATED USER
const changePassword = async (req, res) => {
    try{
        // GET CURRENT AND NEW PASSOWRD AND FIND THE USER
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user.id);

        // CHECK IF CURRENT PASSWORD IS CORRECT OR NOT
        const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
        if(!isMatch) {
            return res.status(401).json({
                success : false,
                message : 'Current password is incorrect'
            });
        }

        // HASH NEW PASSWORD AND STORE
        const salt = await bcrypt.genSalt(10);
        user.passwordHash = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.status(200).json({
            success : true,
            message : 'Password Changed Successfully'

        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// REGISTER A NEW INSTITUTION ADMIN - ONLY SUPER ADMIN
const registerInstitutionAdmin = async (req, res) => {
    try{
        // GET REQUIRED FIELDS FROM REQUEST
        const { name, email, password, tenantId } = req.body;
        if(!name || !email || !password || !tenantId) {
            return res.status(400).json({
                success : false,
                message : 'Missing required fields'
            });
        }

        // FIND THE INSTITUTION BY ID
        const institution = await Institution.findById(tenantId);
        if(!institution) {
            return res.status(404).json({
                success : false,
                message : 'Institution not found'
            });
        }

        // CHECK WHETHER ADMIN ALREADY PRESENT OR NOT
        const existing = await User.findOne({ email, tenantId });
        if(existing) {
            return res.status(400).json({
                success : false,
                message : 'Admin already exists for this institution'
            });
        }

        // HASH THE PASSWORD
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const hashedVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

        // CREATE NEW INSTITUTION USER
        const user = await User.create({
            name,
            email, 
            passwordHash : hashedPassword,
            role : 'instAdmin',
            tenantId,
            isEmailVerified : false,
            emailVerificationToken : hashedVerificationToken,
            emailVerificationExpire : Date.now() + 24 * 60 * 60 * 1000
        });

        // SEND VERIFICATION MAIL
        const verifyUrl = `${req.protocol}://${req.get('host')}/api/auth/verify-email/${verificationToken}`;
        await sendEmail({
            email : user.email,
            subject : 'Verify your email to access admin panel',
            message : `Please click : ${verifyUrl}`
        });

        res.status(201).json({
            success : true,
            message : 'Institution admin created. Verification email sent',
            user : { id : user._id, name, email, role : 'instAdmin', tenantId }
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// ADD A NEW INSTITUTION ADMIN - ONLY INSTITUTION ADMIN 
const addInstitutionAdmin = async (req, res) => {
    try {
        // GET REQUIRED FIELDS FROM REQUEST
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: name, email, password'
            });
        }

        // GET TENANT FROM THE LOGGED-IN ADMIN
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'You are not associated with any institution'
            });
        }

        // CHECK WHETHER INSTITUTION EXISTS
        const institution = await Institution.findById(tenantId);
        if (!institution) {
            return res.status(404).json({
                success: false,
                message: 'Institution not found'
            });
        }

        // CHECK WHETHER ADMIN ALREADY EXISTS
        const existing = await User.findOne({ email, tenantId });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Admin already exists for this institution'
            });
        }

        // HASH THE PASSWORD
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // GENERATE EMAIL VERIFICATION TOKEN
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const hashedVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

        // CREATE NEW INSTITUTION ADMIN USER
        const user = await User.create({
            name,
            email,
            passwordHash: hashedPassword,
            role: 'instAdmin',
            tenantId,
            isEmailVerified: false,
            emailVerificationToken: hashedVerificationToken,
            emailVerificationExpire: Date.now() + 24 * 60 * 60 * 1000,
            institutionAdminId: req.user.id  
        });

        // SEND VERIFICATION EMAIL
        const verifyUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/verify-email/${verificationToken}`;
        await sendEmail({
            email: user.email,
            subject: 'Verify your email to access admin panel',
            message: `Please click: ${verifyUrl}`
        });

        // TRIGGER NOTIFICATION FOR THE NEW ADMIN
        await triggerNotification({
            userId: user._id,
            title: 'Welcome as Admin',
            type: 'registration',
            message: `You have been added as an admin for ${institution.name}. Please verify your email to access the admin panel.`,
            tenantId,
            email: user.email,
            emailSubject: `Welcome as Admin - ${institution.name}`,
            emailMessage: `Hi ${name},\n\nYou have been added as an administrator for ${institution.name}.\n\nPlease verify your email using the link sent to you.\n\nRegards,\n${institution.name} Team`
        });

        res.status(201).json({
            success: true,
            message: 'Institution admin created successfully. Verification email sent.',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                tenantId: user.tenantId
            }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

module.exports = {
    registerStudent,
    login,
    forgotPassword,
    resetPassword,
    verifyEmail,
    changePassword,
    registerInstitutionAdmin,
    addInstitutionAdmin
};
