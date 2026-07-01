const Institution = require('../models/institution');

const tenantResolver = async (req, res, next) => {
    try {
        const host = req.headers.host;
        if (!host) {
            return res.status(400).json({ success: false, message: 'Host header missing' });
        }

        // Clean host to ignore port
        const hostname = host.split(':')[0];
        const subdomain = hostname.split('.')[0];

        if (subdomain === 'localhost' || subdomain === '127.0.0.1' || subdomain === 'www') {
            req.tenantId = process.env.DEFAULT_TENANT_ID || null;
            return next();
        }

        const institution = await Institution.findOne({ subdomain }).select('_id');
        if (!institution) {
            return res.status(404).json({ success: false, message: 'Institution tenant not found' });
        }

        req.tenantId = institution._id;
        next();
    } catch (err) {
        next(err);
    }
};

module.exports = tenantResolver;
