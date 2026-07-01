exports.superAdminOnly = (req, res, next) => {
  if (req.user.role !== 'superAdmin') {
    return res.status(403).json({ 
        success : false,
        message : 'Access denied. Super admin only.' 
    });
  }
  next();
};

exports.instAdminOnly = (req, res, next) => {
  if (req.user.role !== 'instAdmin') {
    return res.status(403).json({ 
        success : false,
        message : 'Access denied. Institution admin only.' 
    });
  }
  next();
};

// Combined middleware allowing both instAdmin and superAdmin
exports.adminOnly = (req, res, next) => {
  if (req.user.role !== 'instAdmin' && req.user.role !== 'superAdmin') {
    return res.status(403).json({ 
        success : false,
        message : 'Access denied. Admins only.' 
    });
  }
  next();
};

exports.studentOnly = (req, res, next) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({
        success : false,
        message : 'Access denied. Students only.' 
    });
  }
  next();
};
