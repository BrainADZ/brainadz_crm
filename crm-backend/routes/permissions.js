const express = require('express');
const BusinessUnit = require('../models/BusinessUnit');
const Department = require('../models/Department');
const OrganizationTeam = require('../models/OrganizationTeam');
const RolePermission = require('../models/RolePermission');
const UserAccessAssignment = require('../models/UserAccessAssignment');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const authMiddleware = require('../middleware/authMiddleware');
const { loadAuthorization, requirePermission } = require('../middleware/authorization');
const {
  ACTIONS,
  DATA_SCOPES,
  SCOPES,
  PERMISSION_RESOURCES,
  MODULES,
} = require('../config/accessControl');
const {
  getOrganizationWorkspace,
  resolveUserAccess,
} = require('../services/organizationAccessService');
const { writeAuditLog } = require('../services/auditService');

const router = express.Router();
router.use(authMiddleware, loadAuthorization);

const uniqueIds = (values = []) => [...new Set(values.map(String).filter(Boolean))];
const assertBusinessUnits = async (ids) =>
  (await BusinessUnit.countDocuments({ _id: { $in: ids }, status: 'active' })) === ids.length;

router.get('/resources', requirePermission('permissions', 'view'), (req, res) => {
  res.json({
    resources: PERMISSION_RESOURCES,
    actions: ACTIONS,
    scopes: SCOPES,
    dataScopes: DATA_SCOPES,
    modules: MODULES,
  });
});

router.get('/me', async (req, res, next) => {
  try {
    return res.json(await resolveUserAccess(req.user._id));
  } catch (error) {
    return next(error);
  }
});

router.get('/workspace', requirePermission('permissions', 'view'), async (req, res, next) => {
  try {
    return res.json(await getOrganizationWorkspace());
  } catch (error) {
    return next(error);
  }
});

router.put(
  '/departments/:departmentId',
  requirePermission('permissions', 'manage'),
  async (req, res, next) => {
    try {
      const department = await Department.findById(req.params.departmentId);
      if (!department) return res.status(404).json({ message: 'Department not found' });
      const previousValue = department.toObject();
      const businessUnitIds = uniqueIds(req.body.businessUnitIds);
      if (!businessUnitIds.length || !(await assertBusinessUnits(businessUnitIds)))
        return res.status(400).json({ message: 'Select valid business units' });
      if (department.slug === 'development' && req.body.isCompanyWide === false)
        return res
          .status(400)
          .json({ message: 'Development must remain a shared company-wide department' });
      department.description = String(req.body.description ?? department.description).trim();
      department.status = ['active', 'inactive'].includes(req.body.status)
        ? req.body.status
        : department.status;
      department.isCompanyWide =
        department.slug === 'development' ? true : Boolean(req.body.isCompanyWide);
      department.businessUnitIds = businessUnitIds;
      department.defaultModuleIds = [
        ...new Set(
          (req.body.defaultModuleIds || []).filter((key) =>
            MODULES.some((module) => module.key === key),
          ),
        ),
      ];
      department.updatedBy = req.user._id;
      await department.save();
      await writeAuditLog({
        req,
        action: 'department_mapping_updated',
        resource: 'departments',
        resourceId: department._id,
        previousValue,
        newValue: department.toObject(),
      });
      return res.json({ message: 'Department access saved', department });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  '/departments/:departmentId/teams',
  requirePermission('permissions', 'manage'),
  async (req, res, next) => {
    try {
      const department = await Department.findById(req.params.departmentId);
      if (!department) return res.status(404).json({ message: 'Department not found' });
      const name = String(req.body.name || '').trim();
      if (!name) return res.status(400).json({ message: 'Team name is required' });
      const businessUnitIds = uniqueIds(req.body.businessUnitIds);
      if (!businessUnitIds.length || !(await assertBusinessUnits(businessUnitIds)))
        return res.status(400).json({ message: 'Select valid business units' });
      if (businessUnitIds.some((id) => !department.businessUnitIds.map(String).includes(id)))
        return res
          .status(400)
          .json({ message: 'A team cannot use a business unit outside its department' });
      const team = await OrganizationTeam.create({
        name,
        departmentId: department._id,
        businessUnitIds,
        isCompanyWide: Boolean(req.body.isCompanyWide),
        status: 'active',
        createdBy: req.user._id,
        updatedBy: req.user._id,
      });
      await writeAuditLog({
        req,
        action: 'team_created',
        resource: 'teams',
        resourceId: team._id,
        newValue: team.toObject(),
      });
      return res.status(201).json({ message: 'Team created', team });
    } catch (error) {
      return next(error);
    }
  },
);

router.put('/teams/:teamId', requirePermission('permissions', 'manage'), async (req, res, next) => {
  try {
    const team = await OrganizationTeam.findById(req.params.teamId);
    if (!team) return res.status(404).json({ message: 'Team not found' });
    const department = await Department.findById(team.departmentId);
    const previousValue = team.toObject();
    const businessUnitIds = uniqueIds(req.body.businessUnitIds);
    if (
      !businessUnitIds.length ||
      businessUnitIds.some((id) => !department.businessUnitIds.map(String).includes(id))
    )
      return res
        .status(400)
        .json({ message: 'Select business units available in this department' });
    team.name = String(req.body.name || team.name).trim();
    team.businessUnitIds = businessUnitIds;
    team.isCompanyWide = Boolean(req.body.isCompanyWide);
    team.status = ['active', 'inactive'].includes(req.body.status) ? req.body.status : team.status;
    team.updatedBy = req.user._id;
    await team.save();
    await writeAuditLog({
      req,
      action: 'team_mapping_updated',
      resource: 'teams',
      resourceId: team._id,
      previousValue,
      newValue: team.toObject(),
    });
    return res.json({ message: 'Team saved', team });
  } catch (error) {
    return next(error);
  }
});

router.delete(
  '/teams/:teamId',
  requirePermission('permissions', 'manage'),
  async (req, res, next) => {
    try {
      const assigned = await UserAccessAssignment.countDocuments({
        teamIds: req.params.teamId,
        status: 'active',
      });
      if (assigned)
        return res.status(409).json({ message: 'Reassign active users before deleting this team' });
      const team = await OrganizationTeam.findByIdAndDelete(req.params.teamId);
      if (!team) return res.status(404).json({ message: 'Team not found' });
      await writeAuditLog({
        req,
        action: 'team_deleted',
        resource: 'teams',
        resourceId: team._id,
        previousValue: team.toObject(),
      });
      return res.json({ message: 'Team deleted' });
    } catch (error) {
      return next(error);
    }
  },
);

router.get('/assignments', requirePermission('permissions', 'view'), async (req, res, next) => {
  try {
    const query = req.query.userId ? { userId: req.query.userId } : {};
    const assignments = await UserAccessAssignment.find(query)
      .populate('userId', 'name email')
      .populate('roleId', 'roleKey roleLabel hierarchyLevel')
      .populate('departmentId', 'name slug')
      .populate('teamIds', 'name')
      .populate('businessUnitIds', 'name slug')
      .sort({ isPrimary: -1, createdAt: 1 });
    return res.json(assignments);
  } catch (error) {
    return next(error);
  }
});

router.post('/assignments', requirePermission('permissions', 'manage'), async (req, res, next) => {
  try {
    const [user, role, department] = await Promise.all([
      User.findById(req.body.userId),
      RolePermission.findById(req.body.roleId),
      Department.findById(req.body.departmentId),
    ]);
    if (!user || !role || !department)
      return res.status(400).json({ message: 'Valid user, role and department are required' });
    if (role.roleKey === 'super_admin' && req.user.roleKey !== 'super_admin')
      return res
        .status(403)
        .json({ message: 'Only Super Admin can create a Super Admin assignment' });
    if (!DATA_SCOPES.includes(req.body.dataScope))
      return res.status(400).json({ message: 'Select a valid data scope' });
    const businessUnitIds = uniqueIds(req.body.businessUnitIds);
    const teamIds = uniqueIds(req.body.teamIds);
    if (
      !businessUnitIds.length ||
      businessUnitIds.some((id) => !department.businessUnitIds.map(String).includes(id))
    )
      return res
        .status(400)
        .json({ message: 'Assignment business units must belong to the department' });
    if (
      teamIds.length !==
      (await OrganizationTeam.countDocuments({
        _id: { $in: teamIds },
        departmentId: department._id,
        businessUnitIds: { $in: businessUnitIds },
      }))
    )
      return res.status(400).json({
        message: 'Assignment teams must belong to the selected department and business units',
      });
    if (req.body.isPrimary)
      await UserAccessAssignment.updateMany({ userId: user._id }, { $set: { isPrimary: false } });
    const assignment = await UserAccessAssignment.create({
      ...req.body,
      businessUnitIds,
      teamIds,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    await writeAuditLog({
      req,
      targetUserId: user._id,
      action: 'user_assignment_created',
      resource: 'access_assignments',
      resourceId: assignment._id,
      newValue: assignment.toObject(),
    });
    return res.status(201).json({ message: 'Access assignment created', assignment });
  } catch (error) {
    return next(error);
  }
});

router.put(
  '/assignments/:assignmentId',
  requirePermission('permissions', 'manage'),
  async (req, res, next) => {
    try {
      const assignment = await UserAccessAssignment.findById(req.params.assignmentId);
      if (!assignment) return res.status(404).json({ message: 'Access assignment not found' });
      const previousValue = assignment.toObject();
      const allowedFields = [
        'roleId',
        'businessUnitIds',
        'departmentId',
        'teamIds',
        'dataScope',
        'modulePermissionOverrides',
        'isPrimary',
        'status',
        'startDate',
        'endDate',
      ];
      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) assignment[field] = req.body[field];
      });
      assignment.updatedBy = req.user._id;
      await assignment.save();
      await writeAuditLog({
        req,
        targetUserId: assignment.userId,
        action: 'user_assignment_updated',
        resource: 'access_assignments',
        resourceId: assignment._id,
        previousValue,
        newValue: assignment.toObject(),
      });
      return res.json({ message: 'Access assignment saved', assignment });
    } catch (error) {
      return next(error);
    }
  },
);

router.delete(
  '/assignments/:assignmentId',
  requirePermission('permissions', 'manage'),
  async (req, res, next) => {
    try {
      const assignment = await UserAccessAssignment.findByIdAndDelete(req.params.assignmentId);
      if (!assignment) return res.status(404).json({ message: 'Access assignment not found' });
      await writeAuditLog({
        req,
        targetUserId: assignment.userId,
        action: 'user_assignment_removed',
        resource: 'access_assignments',
        resourceId: assignment._id,
        previousValue: assignment.toObject(),
      });
      return res.json({ message: 'Access assignment removed' });
    } catch (error) {
      return next(error);
    }
  },
);

router.post('/preview', requirePermission('permissions', 'view'), async (req, res, next) => {
  try {
    if (req.body.userId) return res.json(await resolveUserAccess(req.body.userId));
    const role = await RolePermission.findOne({
      roleKey: req.body.roleKey,
      active: true,
      legacy: { $ne: true },
    }).lean();
    if (!role) return res.status(404).json({ message: 'Role not found' });
    const visibleModules = MODULES.filter((module) =>
      module.resources.some((resource) =>
        role.permissions.some(
          (permission) => permission.resource === resource && permission.actions.includes('view'),
        ),
      ),
    ).map((module) => module.key);
    return res.json({
      bypass: role.roleKey === 'super_admin',
      role,
      permissions: role.permissions,
      visibleModules,
      dataScope: role.defaultDataScope,
      conflicts: [],
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/audit', requirePermission('audit_logs', 'view'), async (req, res, next) => {
  try {
    const logs = await AuditLog.find({
      resource: { $in: ['permissions', 'roles', 'departments', 'teams', 'access_assignments'] },
    })
      .populate('actorUserId', 'name email')
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    return res.json(logs);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
