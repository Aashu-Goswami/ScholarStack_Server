const User = require('../models/user');
const Institution = require('../models/institution');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendEmail } = require('../services/emailService');

// HELPER FUNCTION TO GENERATE TOKEN
const generateToken = (userId, role, tenantId) => {
    return jwt.sign(
        { id : userId, role, tenantId },
        process.env.JWT_SECRET,
        { expiresIn : process.env.JWT_EXPRIES_IN || '30d' }
    );
};

// HELPER FUNCTION TO RESOLVE TENANT FROM SUBDOMAIN
const resolveTenant = async (req) => {
    const host = req.headers.host;

    let subdomain = host.split('.')[0];
    if(subdomain === 'localhost' || subdomain === 'scholarstack' || subdomain === 'www') {
        if(process.env.DEFAULT_TENANT_ID) {
            return process.env.DEFAULT_TENANT_ID;
        }
        return null;
    }
    const institution = await Institution.findOne({ subdomain }).select('_id');
    if(!institution) {
        throw new Error('Invalid Tenant Subdomain');
    }
    return institution._id;
}