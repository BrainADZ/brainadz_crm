const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

const getAlias = (user) =>
  user.alias ||
  user.name
    ?.split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 8)
    .toUpperCase() ||
  user.email?.split('@')[0]?.slice(0, 8).toUpperCase() ||
  'USER';

const getNickname = (user) => user.nickname || user.email?.split('@')[0] || user.name || 'User';

const loginHistoryResponse = (history = []) =>
  history
    .slice()
    .sort((a, b) => new Date(b.loginTime) - new Date(a.loginTime))
    .slice(0, 20)
    .map((entry) => ({
      id: entry._id,
      loginTime: entry.loginTime,
      sourceIp: entry.sourceIp || 'Unknown',
      loginType: entry.loginType || 'Application',
      loginSubtype: entry.loginSubtype || 'UI Username-Password',
      status: entry.status || 'Success',
      application: entry.application || 'Browser',
      loginUrl: entry.loginUrl || '',
      location: entry.location || '',
      userAgent: entry.userAgent || '',
    }));

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, 'uploads/');
  },
  filename: (req, file, callback) => {
    callback(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, callback) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extension = file.originalname.split('.').pop().toLowerCase();

    if (allowedTypes.test(file.mimetype) && allowedTypes.test(extension)) {
      callback(null, true);
      return;
    }

    callback(new Error('Only images are allowed (jpeg, jpg, png)'));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

const publicProfile = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  crmRole: user.crmRole || user.role,
  department: user.officeModule || user.department || '',
  officeModule: user.officeModule || user.department || '',
  team: user.team || '',
  permissions: user.permissions || [],
  phone: user.phone || '',
  mobile: user.mobile || '',
  address: user.address || '',
  street: user.street || user.address || '',
  city: user.city || '',
  stateProvince: user.stateProvince || '',
  postalCode: user.postalCode || '',
  country: user.country || 'India',
  position: user.position || '',
  imageUrl: user.imageUrl || '',
  alias: getAlias(user),
  nickname: getNickname(user),
  timezone: user.timezone || '(GMT+05:30) India Standard Time (Asia/Kolkata)',
  locale: user.locale || 'English (India)',
  language: user.language || 'English',
  emailEncoding: user.emailEncoding || 'Unicode (UTF-8)',
  securityQuestion: user.securityQuestion || 'In what city were you born?',
  securityAnswerUpdatedAt: user.securityAnswerUpdatedAt || null,
  lastLoginAt: user.lastLoginAt || null,
  passwordChangedAt: user.passwordChangedAt || null,
  createdAt: user.createdAt || null,
  updatedAt: user.updatedAt || null,
  loginHistory: loginHistoryResponse(user.loginHistory),
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User profile not found' });
    }

    return res.json({ user: publicProfile(user) });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User profile not found' });
    }

    const {
      name,
      email,
      password,
      phone,
      mobile,
      address,
      street,
      city,
      stateProvince,
      postalCode,
      country,
      position,
      alias,
      nickname,
    } = req.body;

    if (typeof name === 'string' && name.trim()) user.name = name.trim();
    if (typeof phone === 'string') user.phone = phone.trim();
    if (typeof mobile === 'string') user.mobile = mobile.trim();
    if (typeof address === 'string') user.address = address.trim();
    if (typeof street === 'string') {
      user.street = street.trim();
      user.address = street.trim();
    }
    if (typeof city === 'string') user.city = city.trim();
    if (typeof stateProvince === 'string') user.stateProvince = stateProvince.trim();
    if (typeof postalCode === 'string') user.postalCode = postalCode.trim();
    if (typeof country === 'string') user.country = country.trim() || 'India';
    if (typeof position === 'string') user.position = position.trim();
    if (typeof alias === 'string') user.alias = alias.trim().slice(0, 8).toUpperCase();
    if (typeof nickname === 'string') user.nickname = nickname.trim();

    if (user.role === 'admin') {
      if (typeof email === 'string' && email.trim()) {
        const normalizedEmail = email.trim().toLowerCase();
        const existingUser = await User.findOne({
          email: normalizedEmail,
          _id: { $ne: user._id },
        });

        if (existingUser) {
          return res.status(400).json({ message: 'Email already in use' });
        }

        user.email = normalizedEmail;
      }

      if (typeof password === 'string' && password.trim()) {
        if (password.trim().length < 8) {
          return res.status(400).json({ message: 'Password must be at least 8 characters' });
        }
        user.password = await bcrypt.hash(password.trim(), 10);
        user.passwordChangedAt = new Date();
      }
    }

    if (req.file) {
      user.imageUrl = req.file.path.replace(/\\/g, '/');
    }

    await user.save();
    return res.json({
      message: 'Profile updated successfully',
      user: publicProfile(user),
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/preferences', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User profile not found' });
    }

    const { timezone, locale, language, emailEncoding } = req.body;

    if (typeof timezone === 'string' && timezone.trim()) user.timezone = timezone.trim();
    if (typeof locale === 'string' && locale.trim()) user.locale = locale.trim();
    if (typeof language === 'string' && language.trim()) user.language = language.trim();
    if (typeof emailEncoding === 'string' && emailEncoding.trim())
      user.emailEncoding = emailEncoding.trim();

    await user.save();
    return res.json({
      message: 'Language and time zone updated successfully',
      user: publicProfile(user),
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/password', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User profile not found' });
    }

    const { currentPassword, newPassword, securityQuestion, securityAnswer } = req.body;

    if (!currentPassword || !newPassword || !securityQuestion || !securityAnswer) {
      return res.status(400).json({
        message:
          'Current password, new password, security question, and security answer are required',
      });
    }

    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return res
        .status(400)
        .json({ message: 'Password must contain at least 8 characters, 1 letter, and 1 number' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordChangedAt = new Date();

    user.securityQuestion = securityQuestion.trim();
    user.securityAnswerHash = await bcrypt.hash(securityAnswer.trim(), 10);
    user.securityAnswerUpdatedAt = new Date();

    await user.save();
    return res.json({
      message: 'Password changed successfully',
      user: publicProfile(user),
    });
  } catch (error) {
    console.error('Error changing password:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
