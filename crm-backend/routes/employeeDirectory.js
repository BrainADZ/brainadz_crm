const express = require('express');
const User = require('../models/User');
const Counter = require('../models/Counter');
const BusinessUnit = require('../models/BusinessUnit');
const Department = require('../models/Department');
const OrganizationTeam = require('../models/OrganizationTeam');
const RolePermission = require('../models/RolePermission');
const UserAccessAssignment = require('../models/UserAccessAssignment');
const authMiddleware = require('../middleware/authMiddleware');
const { loadAuthorization, requirePermission } = require('../middleware/authorization');
const { DATA_SCOPES } = require('../config/accessControl');
const { createUser, updateUser, publicUserFields } = require('../services/userService');
const { writeAuditLog } = require('../services/auditService');

const router = express.Router();
router.use(authMiddleware, loadAuthorization);

const nextEmployeeId = async () => {
  const year = new Date().getFullYear();
  const counter = await Counter.findOneAndUpdate(
    { key: `employee_id_${year}` },
    { $inc: { value: 1 } },
    { new: true, upsert: true },
  );
  return `BADZ-${year}-${String(counter.value).padStart(4, '0')}`;
};

const validateAssignments = async (assignments, actor) => {
  if (!Array.isArray(assignments) || !assignments.length)
    throw new Error('Add at least one access assignment');
  const normalized = [];
  for (const [index, input] of assignments.entries()) {
    const businessUnitIds = [...new Set((input.businessUnitIds || []).map(String).filter(Boolean))];
    const teamIds = [...new Set((input.teamIds || []).map(String).filter(Boolean))];
    const [department, role, units, teams] = await Promise.all([
      Department.findById(input.departmentId),
      RolePermission.findById(input.roleId),
      BusinessUnit.find({ _id: { $in: businessUnitIds }, status: 'active' }),
      OrganizationTeam.find({ _id: { $in: teamIds }, status: 'active' }),
    ]);
    if (!department || !role || !role.active)
      throw new Error(`Access row ${index + 1} has an invalid department or role`);
    if (!businessUnitIds.length || units.length !== businessUnitIds.length)
      throw new Error(`Access row ${index + 1} requires valid Business Units`);
    if (businessUnitIds.some((id) => !department.businessUnitIds.map(String).includes(id)))
      throw new Error(`Access row ${index + 1} uses a Business Unit outside the department`);
    if (
      teams.length !== teamIds.length ||
      teams.some(
        (team) =>
          String(team.departmentId) !== String(department._id) ||
          !team.businessUnitIds.some((id) => businessUnitIds.includes(String(id))),
      )
    )
      throw new Error(`Access row ${index + 1} has an invalid team selection`);
    if (!DATA_SCOPES.includes(input.dataScope))
      throw new Error(`Access row ${index + 1} has an invalid data scope`);
    if (role.roleKey === 'super_admin' && actor.roleKey !== 'super_admin')
      throw Object.assign(new Error('Only Super Admin can assign the Super Admin role'), {
        status: 403,
      });
    normalized.push({
      businessUnitIds,
      departmentId: department._id,
      teamIds,
      roleId: role._id,
      dataScope: input.dataScope,
      isPrimary: Boolean(input.isPrimary),
      modulePermissionOverrides: [],
    });
  }
  if (!normalized.some((assignment) => assignment.isPrimary)) normalized[0].isPrimary = true;
  if (normalized.filter((assignment) => assignment.isPrimary).length > 1)
    throw new Error('Only one access assignment can be primary');
  return normalized;
};

const employeeDirectoryPayload = async (users) => {
  const assignments = await UserAccessAssignment.find({
    userId: { $in: users.map((user) => user._id) },
    status: 'active',
  })
    .populate('roleId', 'roleKey roleLabel hierarchyLevel')
    .populate('departmentId', 'name slug')
    .populate('teamIds', 'name')
    .populate('businessUnitIds', 'name slug')
    .sort({ isPrimary: -1, createdAt: 1 })
    .lean();
  const assignmentMap = new Map();
  assignments.forEach((assignment) => {
    const key = String(assignment.userId);
    assignmentMap.set(key, [...(assignmentMap.get(key) || []), assignment]);
  });
  return users.map((user) => ({
    ...user,
    accessAssignments: assignmentMap.get(String(user._id)) || [],
  }));
};

const accessContext = async (assignments) => {
  const primary = assignments.find((assignment) => assignment.isPrimary);
  const [primaryRole, primaryDepartment, units] = await Promise.all([
    RolePermission.findById(primary.roleId),
    Department.findById(primary.departmentId),
    BusinessUnit.find({
      _id: { $in: [...new Set(assignments.flatMap((assignment) => assignment.businessUnitIds))] },
    }),
  ]);
  const communities = [...new Set(units.map((unit) => unit.legacyCommunityKey).filter(Boolean))];
  return { primaryRole, primaryDepartment, communities };
};

router.get('/', requirePermission('employees', 'view'), async (req, res, next) => {
  try {
    const users = await User.find({
      userType: 'employee',
      roleKey: { $ne: 'super_admin' },
      isDeleted: { $ne: true },
    })
      .select(publicUserFields)
      .sort({ createdAt: -1 })
      .lean();
    return res.json(await employeeDirectoryPayload(users));
  } catch (error) {
    return next(error);
  }
});

router.post('/', requirePermission('employees', 'create'), async (req, res, next) => {
  let createdUser;
  try {
    const assignments = await validateAssignments(req.body.assignments, req.user);
    const { primaryRole, primaryDepartment, communities } = await accessContext(assignments);
    const employeeId = await nextEmployeeId();
    createdUser = await createUser({
      actor: req.user,
      req,
      payload: {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        password: req.body.password,
        sendInvitation: Boolean(req.body.sendInvitation),
        employeeId,
        userType: 'employee',
        roleKey: primaryRole.roleKey,
        communities,
        primaryCommunity: communities[0],
        officeModule: primaryDepartment.name,
        team: '',
        position: req.body.position || 'Employee',
        employmentType: req.body.employmentType || 'full_time',
        joiningDate: req.body.joiningDate || new Date(),
        workLocation: req.body.workLocation || '',
        address: req.body.address || '',
        emergencyContact: req.body.emergencyContact || '',
        accountStatus: 'active',
      },
    });
    const accessAssignments = await UserAccessAssignment.insertMany(
      assignments.map((assignment) => ({
        ...assignment,
        userId: createdUser._id,
        status: 'active',
        startDate: new Date(),
        createdBy: req.user._id,
        updatedBy: req.user._id,
      })),
    );
    await writeAuditLog({
      req,
      targetUserId: createdUser._id,
      action: 'employee_with_access_created',
      resource: 'employees',
      resourceId: createdUser._id,
      newValue: {
        employeeId,
        assignmentIds: accessAssignments.map((assignment) => assignment._id),
      },
    });
    return res.status(201).json({
      message: `Employee ${employeeId} created successfully`,
      employee: createdUser,
      accessAssignments,
    });
  } catch (error) {
    if (createdUser?._id) {
      await UserAccessAssignment.deleteMany({ userId: createdUser._id });
      await User.deleteOne({ _id: createdUser._id });
    }
    return next(error);
  }
});

router.put('/:employeeId', requirePermission('employees', 'update'), async (req, res, next) => {
  try {
    const employee = await User.findOne({
      _id: req.params.employeeId,
      userType: 'employee',
      roleKey: { $ne: 'super_admin' },
      isDeleted: { $ne: true },
    });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    const assignments = await validateAssignments(req.body.assignments, req.user);
    const { primaryRole, primaryDepartment, communities } = await accessContext(assignments);
    const updatedUser = await updateUser({
      userId: employee._id,
      actor: req.user,
      req,
      payload: {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        password: req.body.password || undefined,
        userType: 'employee',
        roleKey: primaryRole.roleKey,
        communities,
        primaryCommunity: communities[0],
        officeModule: primaryDepartment.name,
        team: '',
        position: req.body.position || 'Employee',
        employmentType: req.body.employmentType,
        joiningDate: req.body.joiningDate,
        workLocation: req.body.workLocation || '',
        address: req.body.address || '',
        emergencyContact: req.body.emergencyContact || '',
        accountStatus: employee.accountStatus,
      },
    });
    const now = new Date();
    await UserAccessAssignment.updateMany(
      { userId: employee._id, status: 'active' },
      { $set: { status: 'inactive', endDate: now, updatedBy: req.user._id } },
    );
    const createdAssignments = await UserAccessAssignment.insertMany(
      assignments.map((assignment) => ({
        ...assignment,
        userId: employee._id,
        status: 'active',
        startDate: now,
        endDate: null,
        createdBy: req.user._id,
        updatedBy: req.user._id,
      })),
    );
    await writeAuditLog({
      req,
      targetUserId: employee._id,
      action: 'employee_access_updated',
      resource: 'employees',
      resourceId: employee._id,
      newValue: { assignmentIds: createdAssignments.map((assignment) => assignment._id) },
    });
    const [directoryEmployee] = await employeeDirectoryPayload([
      updatedUser.toObject ? updatedUser.toObject() : updatedUser,
    ]);
    return res.json({
      message: `Employee ${updatedUser.employeeId || updatedUser.name} updated successfully`,
      employee: directoryEmployee,
    });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:employeeId', requirePermission('employees', 'delete'), async (req, res, next) => {
  try {
    if (String(req.params.employeeId) === String(req.user._id))
      return res.status(400).json({ message: 'You cannot delete your own account' });
    const employee = await User.findOne({
      _id: req.params.employeeId,
      userType: 'employee',
      roleKey: { $ne: 'super_admin' },
      isDeleted: { $ne: true },
    });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    const previousValue = employee.toObject();
    employee.isDeleted = true;
    employee.deletedAt = new Date();
    employee.accountStatus = 'inactive';
    employee.sessionVersion = (employee.sessionVersion || 0) + 1;
    await employee.save();
    await UserAccessAssignment.updateMany(
      { userId: employee._id, status: 'active' },
      { $set: { status: 'inactive', endDate: new Date(), updatedBy: req.user._id } },
    );
    await writeAuditLog({
      req,
      targetUserId: employee._id,
      action: 'employee_deleted',
      resource: 'employees',
      resourceId: employee._id,
      previousValue,
      newValue: { isDeleted: true, accountStatus: 'inactive' },
    });
    return res.json({
      message: `Employee ${employee.employeeId || employee.name} deleted successfully`,
      employeeId: employee._id,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
