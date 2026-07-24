const express = require('express');
const RolePermission = require('../models/RolePermission');
const User = require('../models/User');
const UserAccessAssignment = require('../models/UserAccessAssignment');
const authMiddleware = require('../middleware/authMiddleware');
const {
  loadAuthorization,
  requirePermission,
  preventPrivilegeEscalation,
} = require('../middleware/authorization');
const {
  ROLE_TEMPLATES,
  SCOPES,
  DATA_SCOPES,
  USER_TYPES,
  PERMISSION_RESOURCES,
  MODULES,
} = require('../config/accessControl');
const { normalizePermission } = require('../services/accessControlService');
const { canGrantPermission } = require('../services/accessControlService');
const { ensureAccessFoundation } = require('../services/organizationAccessService');
const { writeAuditLog } = require('../services/auditService');

const router = express.Router();
router.use(authMiddleware, loadAuthorization);

const normalizeRolePayload = (body) => ({
  roleKey: String(body.roleKey || '')
    .trim()
    .toLowerCase(),
  roleLabel: String(body.roleLabel || body.roleName || '').trim(),
  description: String(body.description || '').trim(),
  hierarchyLevel: Math.max(0, Math.min(99, Number(body.hierarchyLevel) || 20)),
  allowedUserTypes: [
    ...new Set((body.allowedUserTypes || ['employee']).filter((item) => USER_TYPES.includes(item))),
  ],
  permissions: (body.permissions || [])
    .map(normalizePermission)
    .filter((item) => item.resource && PERMISSION_RESOURCES.includes(item.resource)),
  defaultScope: SCOPES.includes(body.defaultScope) ? body.defaultScope : 'ASSIGNED',
  defaultDataScope: DATA_SCOPES.includes(body.defaultDataScope)
    ? body.defaultDataScope
    : 'ASSIGNED',
  assignableBusinessUnitIds: [...new Set((body.assignableBusinessUnitIds || []).map(String))],
  assignableDepartmentIds: [...new Set((body.assignableDepartmentIds || []).map(String))],
  assignableTeamIds: [...new Set((body.assignableTeamIds || []).map(String))],
  active: body.active !== false,
});

const withCounts = async (roles) => {
  const [assignmentCounts, legacyCounts] = await Promise.all([
    UserAccessAssignment.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$roleId', count: { $sum: 1 } } },
    ]),
    User.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: '$roleKey', count: { $sum: 1 } } },
    ]),
  ]);
  const assignmentMap = new Map(assignmentCounts.map((item) => [String(item._id), item.count]));
  const legacyMap = new Map(legacyCounts.map((item) => [item._id, item.count]));
  return roles.map((role) => ({
    ...role,
    userCount: (assignmentMap.get(String(role._id)) || 0) + (legacyMap.get(role.roleKey) || 0),
  }));
};

router.get('/', requirePermission('roles', 'view'), async (req, res, next) => {
  try {
    await ensureAccessFoundation();
    const query = req.query.includeLegacy === 'true' ? {} : { legacy: { $ne: true } };
    const roles = await RolePermission.find(query)
      .sort({ hierarchyLevel: -1, roleLabel: 1 })
      .lean();
    return res.json(await withCounts(roles));
  } catch (error) {
    return next(error);
  }
});

router.get('/meta/resources/list', requirePermission('permissions', 'view'), (req, res) =>
  res.json({
    resources: PERMISSION_RESOURCES,
    actions: require('../config/accessControl').ACTIONS,
    scopes: SCOPES,
    dataScopes: DATA_SCOPES,
    modules: MODULES,
  }),
);

router.post(
  '/',
  requirePermission('roles', 'create'),
  preventPrivilegeEscalation(),
  async (req, res, next) => {
    try {
      const payload = normalizeRolePayload(req.body);
      if (!/^[a-z][a-z0-9_]*$/.test(payload.roleKey))
        return res
          .status(400)
          .json({ message: 'Role key must use lowercase letters, numbers and underscores' });
      if (!payload.roleLabel) return res.status(400).json({ message: 'Role name is required' });
      const existing = await RolePermission.findOne({ roleKey: payload.roleKey });
      if (existing && !existing.legacy) {
        return res.status(409).json({
          message: `Role "${existing.roleLabel}" already exists. Select it from the Roles list.`,
        });
      }

      if (existing?.legacy) {
        const previousValue = existing.toObject();
        Object.assign(existing, payload, {
          locked: false,
          systemRole: false,
          legacy: false,
          createdBy: existing.createdBy || req.user._id,
          updatedBy: req.user._id,
        });
        await existing.save();
        const restoredRole = (await withCounts([existing.toObject()]))[0];
        await writeAuditLog({
          req,
          action: 'legacy_role_restored_as_custom',
          resource: 'roles',
          resourceId: existing.roleKey,
          previousValue,
          newValue: existing.toObject(),
        });
        return res.status(200).json({
          message: `Existing ${existing.roleLabel} role restored. Configure its module permissions now.`,
          role: restoredRole,
        });
      }

      const role = await RolePermission.create({
        ...payload,
        locked: false,
        systemRole: false,
        legacy: false,
        createdBy: req.user._id,
        updatedBy: req.user._id,
      });
      await writeAuditLog({
        req,
        action: 'role_created',
        resource: 'roles',
        resourceId: role.roleKey,
        newValue: role.toObject(),
      });
      return res
        .status(201)
        .json({ message: 'Custom role created', role: (await withCounts([role.toObject()]))[0] });
    } catch (error) {
      return next(error);
    }
  },
);

router.post('/:roleKey/duplicate', requirePermission('roles', 'create'), async (req, res, next) => {
  try {
    const source = await RolePermission.findOne({ roleKey: req.params.roleKey }).lean();
    if (!source) return res.status(404).json({ message: 'Role not found' });
    if (
      req.user.roleKey !== 'super_admin' &&
      !canGrantPermission(req.effectivePermissions || [], source.permissions || [])
    )
      return res
        .status(403)
        .json({ message: 'Cannot duplicate a role with greater access than your own' });
    const roleKey = String(req.body.roleKey || `${source.roleKey}_copy`)
      .trim()
      .toLowerCase();
    if (!/^[a-z][a-z0-9_]*$/.test(roleKey))
      return res.status(400).json({ message: 'Enter a valid duplicate role name' });
    const role = await RolePermission.create({
      ...source,
      _id: undefined,
      roleKey,
      roleLabel: String(req.body.roleLabel || `${source.roleLabel} Copy`).trim(),
      locked: false,
      systemRole: false,
      legacy: false,
      createdBy: req.user._id,
      updatedBy: req.user._id,
      createdAt: undefined,
      updatedAt: undefined,
    });
    await writeAuditLog({
      req,
      action: 'role_duplicated',
      resource: 'roles',
      resourceId: role.roleKey,
      newValue: role.toObject(),
      metadata: { sourceRoleKey: source.roleKey },
    });
    return res.status(201).json({ message: 'Role duplicated', role });
  } catch (error) {
    return next(error);
  }
});

router.post(
  '/:roleKey/reset-default',
  requirePermission('roles', 'manage'),
  async (req, res, next) => {
    try {
      const template = ROLE_TEMPLATES.find((item) => item.roleKey === req.params.roleKey);
      if (!template)
        return res.status(400).json({ message: 'No system default exists for this role' });
      if (template.roleKey === 'super_admin')
        return res.status(403).json({ message: 'Super Admin is already locked to full access' });
      const role = await RolePermission.findOneAndUpdate(
        { roleKey: template.roleKey },
        { $set: { ...template, updatedBy: req.user._id } },
        { new: true, upsert: true, runValidators: true },
      );
      await User.updateMany({ roleKey: role.roleKey }, { $inc: { sessionVersion: 1 } });
      await writeAuditLog({
        req,
        action: 'role_reset_default',
        resource: 'roles',
        resourceId: role.roleKey,
        newValue: role.toObject(),
      });
      return res.json({ message: 'Role reset to secure default', role });
    } catch (error) {
      return next(error);
    }
  },
);

router.get('/:roleKey', requirePermission('roles', 'view'), async (req, res, next) => {
  try {
    const role = await RolePermission.findOne({ roleKey: req.params.roleKey }).lean();
    if (!role) return res.status(404).json({ message: 'Role not found' });
    return res.json((await withCounts([role]))[0]);
  } catch (error) {
    return next(error);
  }
});

router.put(
  '/:roleKey',
  requirePermission('roles', 'update'),
  preventPrivilegeEscalation(),
  async (req, res, next) => {
    try {
      const role = await RolePermission.findOne({ roleKey: req.params.roleKey });
      if (!role) return res.status(404).json({ message: 'Role not found' });
      if (role.roleKey === 'super_admin' || role.locked)
        return res.status(403).json({ message: 'Super Admin permissions cannot be modified' });
      const previousValue = role.toObject();
      const payload = normalizeRolePayload({ ...req.body, roleKey: role.roleKey });
      const savedRole = await RolePermission.findOneAndUpdate(
        { _id: role._id, roleKey: role.roleKey },
        {
          $set: {
            ...payload,
            roleKey: role.roleKey,
            systemRole: role.systemRole,
            legacy: role.legacy,
            updatedBy: req.user._id,
          },
        },
        { new: true, runValidators: true },
      );
      await User.updateMany({ roleKey: savedRole.roleKey }, { $inc: { sessionVersion: 1 } });
      await writeAuditLog({
        req,
        action: 'role_updated',
        resource: 'roles',
        resourceId: savedRole.roleKey,
        previousValue,
        newValue: savedRole.toObject(),
      });
      return res.json({ message: 'Role updated', role: savedRole });
    } catch (error) {
      return next(error);
    }
  },
);

router.delete('/:roleKey', requirePermission('roles', 'delete'), async (req, res, next) => {
  try {
    const role = await RolePermission.findOne({ roleKey: req.params.roleKey });
    if (!role) return res.status(404).json({ message: 'Role not found' });
    if (role.systemRole || role.locked)
      return res.status(403).json({ message: 'System roles cannot be deleted' });
    const assigned =
      (await UserAccessAssignment.countDocuments({ roleId: role._id, status: 'active' })) +
      (await User.countDocuments({ roleKey: role.roleKey, isDeleted: { $ne: true } }));
    if (assigned)
      return res.status(409).json({ message: 'Reassign active users before deleting this role' });
    await role.deleteOne();
    await writeAuditLog({
      req,
      action: 'role_deleted',
      resource: 'roles',
      resourceId: role.roleKey,
      previousValue: role.toObject(),
    });
    return res.json({ message: 'Custom role deleted' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
