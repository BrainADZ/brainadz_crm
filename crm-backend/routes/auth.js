const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { COMMUNITY_KEYS } = require('../config/accessControl');
const { writeAuditLog } = require('../services/auditService');

const router = express.Router();
const TOKEN_EXPIRES_IN = '7d';
const loginAttempts = new Map();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

const rateLimitLogin = (req, res, next) => {
  const key = `${getSourceIp(req)}:${String(req.body.email || '').toLowerCase()}`;
  const now = Date.now();
  const current = loginAttempts.get(key) || { count: 0, resetAt: now + WINDOW_MS };
  if (current.resetAt <= now) {
    current.count = 0;
    current.resetAt = now + WINDOW_MS;
  }
  current.count += 1;
  loginAttempts.set(key, current);
  if (current.count > MAX_ATTEMPTS)
    return res.status(429).json({ message: 'Too many login attempts. Try again later.' });
  req.loginAttemptKey = key;
  return next();
};

const getSourceIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || 'Unknown';
};

const recordLogin = async (user, req, status = 'Success') => {
  const now = new Date();
  user.lastLoginAt = now;
  user.loginHistory = [
    {
      loginTime: now,
      sourceIp: getSourceIp(req),
      status,
      loginUrl: req.get('origin') || req.get('host') || '',
      location: 'India',
      userAgent: req.get('user-agent') || '',
    },
    ...(user.loginHistory || []),
  ].slice(0, 25);

  await user.save();
};

const handleLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({
      email: String(email || '')
        .trim()
        .toLowerCase(),
      isDeleted: { $ne: true },
    }).select('+password');
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = user.password && (await bcrypt.compare(String(password || ''), user.password));
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (user.accountStatus !== 'active')
      return res.status(403).json({ message: `Account is ${user.accountStatus}` });

    if (
      user.role === 'admin' &&
      (user.roleKey !== 'super_admin' ||
        COMMUNITY_KEYS.some((key) => !(user.communities || []).includes(key)))
    ) {
      user.roleKey = 'super_admin';
      user.crmRole = 'super_admin';
      user.communities = COMMUNITY_KEYS;
      user.primaryCommunity = user.primaryCommunity || 'live';
      user.accountStatus = 'active';
    }

    await recordLogin(user, req);

    const payload = {
      user: {
        id: user._id,
        role: user.role,
        roleKey: user.roleKey || user.crmRole,
        crmRole: user.crmRole || user.roleKey,
        communities: user.communities || [],
        sessionVersion: user.sessionVersion || 0,
      },
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });

    loginAttempts.delete(req.loginAttemptKey);
    await writeAuditLog({
      req,
      actorUserId: user._id,
      targetUserId: user._id,
      action: 'login_success',
      resource: 'auth',
      resourceId: user._id,
      communityKey: user.primaryCommunity,
    });
    return res.json({
      token,
      workspace: user.role === 'admin' ? 'admin' : 'employee',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        roleKey: user.roleKey || user.crmRole,
        crmRole: user.crmRole || user.roleKey,
        communities: user.communities || [],
        primaryCommunity: user.primaryCommunity,
      },
    });
  } catch (err) {
    console.error('Error during login:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

router.post('/login', rateLimitLogin, handleLogin);
router.post('/employee-login', rateLimitLogin, handleLogin);

module.exports = router;
