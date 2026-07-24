const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const authMiddleware = require('../middleware/authMiddleware');
const { loadAuthorization, requirePermission } = require('../middleware/authorization');
const { resolveEffectivePermissions } = require('../services/accessControlService');
const { createUser, updateUser, publicUserFields } = require('../services/userService');
const { writeAuditLog } = require('../services/auditService');

const router = express.Router();
router.use(authMiddleware, loadAuthorization);

const listScopeQuery = (req) => {
  if (req.user.roleKey === 'super_admin' || ['all', 'COMPANY'].includes(req.permission?.scope))
    return { isDeleted: { $ne: true } };
  const query = { isDeleted: { $ne: true }, communities: { $in: req.user.communities } };
  if (['department', 'DEPARTMENT'].includes(req.permission?.scope))
    query.officeModule = req.user.officeModule;
  if (['team', 'TEAM', 'MULTIPLE_TEAMS'].includes(req.permission?.scope))
    query.team = req.user.team;
  if (['self', 'OWN'].includes(req.permission?.scope)) query._id = req.user._id;
  return query;
};

router.get('/', requirePermission('users', 'view'), async (req, res, next) => {
  try {
    const query = listScopeQuery(req);
    if (req.query.userType) query.userType = req.query.userType;
    if (req.query.community) query.communities = req.query.community;
    if (req.query.officeModule) query.officeModule = req.query.officeModule;
    if (req.query.team) query.team = req.query.team;
    if (req.query.roleKey) query.roleKey = req.query.roleKey;
    if (req.query.accountStatus) query.accountStatus = req.query.accountStatus;
    if (req.query.reportingManager) query.reportingManager = req.query.reportingManager;
    if (req.query.search)
      query.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { employeeId: { $regex: req.query.search, $options: 'i' } },
        { clientCompany: { $regex: req.query.search, $options: 'i' } },
        { vendorCompany: { $regex: req.query.search, $options: 'i' } },
      ];
    const users = await User.find(query)
      .select(publicUserFields)
      .populate('reportingManager', 'name email')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    next(error);
  }
});

router.post('/', requirePermission('users', 'create'), async (req, res, next) => {
  try {
    res.status(201).json({
      message: 'User created successfully',
      user: await createUser({ payload: req.body, actor: req.user, req }),
    });
  } catch (error) {
    next(error);
  }
});

router.get(
  '/:id/effective-permissions',
  requirePermission('users', 'view'),
  async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id)
        .select(publicUserFields)
        .populate('reportingManager', 'name email');
      if (!user) return res.status(404).json({ message: 'User not found' });
      const permissions = await resolveEffectivePermissions(user);
      res.json({ user, permissions, overrides: user.permissionOverrides, roleKey: user.roleKey });
    } catch (error) {
      next(error);
    }
  },
);

router.get('/:id/audit-logs', requirePermission('audit_logs', 'view'), async (req, res, next) => {
  try {
    res.json(
      await AuditLog.find({ targetUserId: req.params.id }).sort({ createdAt: -1 }).limit(200),
    );
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requirePermission('users', 'view'), async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, ...listScopeQuery(req) })
      .select(publicUserFields)
      .populate('reportingManager', 'name email');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requirePermission('users', 'update'), async (req, res, next) => {
  try {
    res.json({
      message: 'User updated successfully',
      user: await updateUser({ userId: req.params.id, payload: req.body, actor: req.user, req }),
    });
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/:id/status',
  requirePermission('user_activation', 'manage'),
  async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      if (user.roleKey === 'super_admin')
        return res.status(403).json({ message: 'Super Admin cannot be disabled' });
      const status = String(req.body.status || '').toLowerCase();
      if (!['active', 'suspended', 'inactive'].includes(status))
        return res.status(400).json({ message: 'Invalid account status' });
      const previousValue = { accountStatus: user.accountStatus };
      user.accountStatus = status;
      user.sessionVersion = (user.sessionVersion || 0) + 1;
      await user.save();
      await writeAuditLog({
        req,
        targetUserId: user._id,
        action: `user_${status}`,
        resource: 'users',
        resourceId: user._id,
        previousValue,
        newValue: { accountStatus: status },
        communityKey: user.primaryCommunity,
      });
      res.json({ message: `User ${status}`, user });
    } catch (error) {
      next(error);
    }
  },
);

router.post('/:id/send-invite', requirePermission('users', 'manage'), async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { invitationSentAt: new Date(), accountStatus: 'invited', $inc: { sessionVersion: 1 } },
      { new: true },
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    await writeAuditLog({
      req,
      targetUserId: user._id,
      action: 'invitation_sent',
      resource: 'users',
      resourceId: user._id,
      communityKey: user.primaryCommunity,
    });
    res.json({
      message: 'Invitation marked as sent. Connect an email provider to deliver it.',
      user,
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:id/reset-password',
  requirePermission('password_reset', 'manage'),
  async (req, res, next) => {
    try {
      const generatedPassword = req.body.password || crypto.randomBytes(12).toString('base64url');
      if (generatedPassword.length < 8)
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
      const user = await User.findById(req.params.id).select('+password');
      if (!user) return res.status(404).json({ message: 'User not found' });
      user.password = await bcrypt.hash(generatedPassword, 10);
      user.passwordChangedAt = new Date();
      user.sessionVersion = (user.sessionVersion || 0) + 1;
      await user.save();
      await writeAuditLog({
        req,
        targetUserId: user._id,
        action: 'password_reset',
        resource: 'users',
        resourceId: user._id,
        communityKey: user.primaryCommunity,
      });
      res.json({
        message: 'Password reset successfully',
        temporaryPassword: req.body.password ? undefined : generatedPassword,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.delete('/:id', requirePermission('users', 'delete'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.roleKey === 'super_admin')
      return res.status(403).json({ message: 'Super Admin cannot be deleted' });
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.accountStatus = 'inactive';
    user.sessionVersion += 1;
    await user.save();
    await writeAuditLog({
      req,
      targetUserId: user._id,
      action: 'user_deactivated',
      resource: 'users',
      resourceId: user._id,
      communityKey: user.primaryCommunity,
    });
    res.json({ message: 'User deactivated safely' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
