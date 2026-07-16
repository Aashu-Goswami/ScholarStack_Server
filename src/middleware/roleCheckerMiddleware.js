// ROLE-BASED ACCESS CONTROL (RBAC) MIDDLEWARE
// PROVIDES MIDDLEWARE FUNCTIONS TO RESTRICT ROUTE ACCESS BASED ON USER ROLES
// THESE MUST BE USED AFTER THE 'protect' MIDDLEWARE 

// RESTRICT ACCESS TO SUPER ADMIN ONLY
exports.superAdminOnly = (req, res, next) => {
  if (req.user.role !== 'superAdmin') {
    return res.status(403).json({ 
        success : false,
        message : 'Access denied. Super admin only.' 
    });
  }
  next();
};

// RESTRICT ACCESS TO INSTITUTION ADMIN ONLY
exports.instAdminOnly = (req, res, next) => {
  if (req.user.role !== 'instAdmin') {
    return res.status(403).json({ 
        success : false,
        message : 'Access denied. Institution admin only.' 
    });
  }
  next();
};

// RESTRICT ACCESS TO STUDENTS ONLY
exports.studentOnly = (req, res, next) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({
        success : false,
        message : 'Access denied. Students only.' 
    });
  }
  next();
};

// RESTRICT ACCESS TO SUPER ADMIN OR THE INSTITUTION ADMIN OF THE REQUESTED INSTITUTION
exports.superAdminOrOwnInstitution = (req, res, next) => {

  // SUPER ADMIN CAN ACCESS ANY INSTITUTION 
  if (req.user.role === 'superAdmin') {
    return next();
  }

  // INSTITUTION ADMIN CAN ACCESS ONLY THEIR OWN INSTITUTION 
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
