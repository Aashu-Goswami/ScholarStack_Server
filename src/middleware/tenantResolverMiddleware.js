// TENANT RESOLVER MIDDLEWARE
// EXTRACTS THE TENANT ID FROM THE SUBDOMAIN IN THE REQUEST'S HOST HEADER
// ATTACHES THE RESOLVED TENANT ID TO 'req.tenantId'

const Institution = require('../models/institution');
const DEVELOPMENT_SUBDOMAINS = new Set(['localhost', '127.0.0.1', 'www', 'scholarstack']);

const resolveTenantFromSubdomain = async (req, options = {}) => {
    const { throwOnInvalid = false } = options;

    const host = req.headers.host;
    if (!host) {
        return null;
    }

    const hostname = host.split(':')[0];
    const subdomain = hostname.split('.')[0];

    // SUPER ADMIN SUBDOMAIN
    if (subdomain === 'super') {
        return null;
    }

    // DEVELOPMENT MODE
    if (DEVELOPMENT_SUBDOMAINS.has(subdomain)) {
        return process.env.DEFAULT_TENANT_ID || null;
    }

    // LOOK UP INSTITUTION BY SUBDOMAIN
    const institution = await Institution.findOne({ subdomain }).select('_id');
    if (!institution) {
        if (throwOnInvalid) {
            throw new Error('Invalid Tenant Subdomain');
        }
        return null;
    }

    return institution._id;
};

const tenantResolver = async (req, res, next) => {
    try {
        const tenantId = await resolveTenantFromSubdomain(req);

        const host = req.headers.host;
        if (host) {
            const hostname = host.split(':')[0];
            const subdomain = hostname.split('.')[0];
            if (!tenantId && !DEVELOPMENT_SUBDOMAINS.has(subdomain) && subdomain !== 'super') {
                return res.status(404).json({
                    success: false,
                    message: 'Institution tenant not found'
                });
            }
        }

        req.tenantId = tenantId;
        next();
    } catch (err) {
        next(err);
    }
};

module.exports = {
    resolveTenantFromSubdomain,
    tenantResolver
};
