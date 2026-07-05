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

exports.studentOnly = (req, res, next) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({
        success : false,
        message : 'Access denied. Students only.' 
    });
  }
  next();
};

exports.superAdminOrOwnInstitution = (req, res, next) => {
  // Super admin can access any institution
  if (req.user.role === 'superAdmin') {
    return next();
  }

  // Institution admin can access only their own institution
  if (
    req.user.role === 'instAdmin' &&
    req.user.tenantId &&
    req.user.tenantId.toString() === req.params.id
  ) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied'
  });
};