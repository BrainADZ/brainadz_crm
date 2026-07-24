const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
    if (!decoded.user?.id) return res.status(401).json({ message: 'Invalid authentication token' });

    const user = await User.findById(decoded.user.id).select('-password -securityAnswerHash');
    if (!user || user.isDeleted) return res.status(401).json({ message: 'User no longer exists' });
    if (user.accountStatus !== 'active')
      return res.status(403).json({ message: `Account is ${user.accountStatus}` });
    if ((decoded.user.sessionVersion ?? 0) !== (user.sessionVersion || 0)) {
      return res.status(401).json({ message: 'Session expired after an access change' });
    }

    req.user = user;
    req.user.id = String(user._id);
    req.user.roleKey =
      user.role === 'admin'
        ? 'super_admin'
        : user.crmRole && user.crmRole !== 'employee'
          ? user.crmRole
          : user.roleKey || 'employee';

    next();
  } catch {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = authMiddleware;
