const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const RolePermission = require('../models/RolePermission');
const OfficeStructure = require('../models/OfficeStructure');
const { COMMUNITY_KEYS, USER_TYPES, ACCOUNT_STATUSES } = require('../config/accessControl');
const { writeAuditLog } = require('./auditService');

const publicUserFields = '-password -securityAnswerHash -loginHistory';
const normalizeCommunities = (value) => [
  ...new Set(
    (Array.isArray(value) ? value : String(value || '').split(','))
      .map((key) => String(key).trim().toLowerCase())
      .filter((key) => COMMUNITY_KEYS.includes(key)),
  ),
];
const normalizePhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  const local = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits;
  if (!/^\d{10}$/.test(local)) throw new Error('Phone number must contain exactly 10 digits');
  return `+91${local}`;
};

const assertManagerChain = async (userId, managerId) => {
  if (!managerId) return;
  if (userId && String(userId) === String(managerId))
    throw new Error('Reporting manager cannot be the same user');
  let currentId = managerId;
  const visited = new Set(userId ? [String(userId)] : []);
  for (let depth = 0; currentId && depth < 50; depth += 1) {
    if (visited.has(String(currentId)))
      throw new Error('Circular reporting manager relationship is not allowed');
    visited.add(String(currentId));
    const current = await User.findById(currentId).select('reportingManager');
    currentId = current?.reportingManager;
  }
};

const validateUserInput = async ({ payload, actor, existingUser = null }) => {
  const userType = payload.userType || existingUser?.userType || 'employee';
  if (!USER_TYPES.includes(userType)) throw new Error('Invalid user type');
  const communities = normalizeCommunities(payload.communities ?? existingUser?.communities);
  if (!communities.length) throw new Error('At least one community is required');
  if (
    actor.roleKey !== 'super_admin' &&
    communities.some((key) => !actor.communities.includes(key))
  ) {
    const error = new Error('Cannot assign communities outside your own access');
    error.status = 403;
    throw error;
  }

  const roleKey = String(payload.roleKey || payload.crmRole || existingUser?.roleKey || 'employee')
    .trim()
    .toLowerCase();
  if (roleKey === 'super_admin' && actor.roleKey !== 'super_admin') {
    const error = new Error('Only Super Admin can assign the Super Admin role');
    error.status = 403;
    throw error;
  }
  const role = await RolePermission.findOne({ roleKey, active: true });
  if (!role) throw new Error('Selected CRM role does not exist or is inactive');
  if (role.allowedUserTypes?.length && !role.allowedUserTypes.includes(userType))
    throw new Error('Selected role is not compatible with this user type');

  const officeModule = String(
    payload.officeModule || payload.department || existingUser?.officeModule || '',
  ).trim();
  const team = String(payload.team ?? existingUser?.team ?? '').trim();
  if (team) {
    const teamExists = await OfficeStructure.exists({
      type: 'team',
      name: team,
      moduleName: officeModule,
    });
    if (!teamExists) throw new Error('Selected team does not belong to the selected office module');
  }

  const reportingManager = payload.reportingManager || existingUser?.reportingManager || null;
  if (reportingManager) {
    const manager = await User.findOne({
      _id: reportingManager,
      isDeleted: { $ne: true },
      accountStatus: { $ne: 'inactive' },
    }).select('communities');
    if (!manager) throw new Error('Reporting manager not found');
    if (!manager.communities.some((key) => communities.includes(key)))
      throw new Error('Reporting manager must share an authorized community');
    await assertManagerChain(existingUser?._id, reportingManager);
  }

  return { userType, communities, roleKey, role, officeModule, team, reportingManager };
};

const buildUserPayload = async ({ payload, actor, existingUser }) => {
  const validated = await validateUserInput({ payload, actor, existingUser });
  const next = {
    name: String(payload.name || existingUser?.name || '').trim(),
    email: String(payload.email || existingUser?.email || '')
      .trim()
      .toLowerCase(),
    phone: normalizePhone(payload.phone || existingUser?.phone),
    userType: validated.userType,
    roleKey: validated.roleKey,
    crmRole: validated.roleKey,
    role: validated.roleKey === 'super_admin' ? 'admin' : 'employee',
    communities: validated.communities,
    primaryCommunity: validated.communities.includes(payload.primaryCommunity)
      ? payload.primaryCommunity
      : validated.communities[0],
    officeModule: validated.officeModule,
    department: validated.officeModule,
    team: validated.team,
    reportingManager: validated.reportingManager,
  };

  const assignable = [
    'employeeId',
    'position',
    'employmentType',
    'joiningDate',
    'accountStatus',
    'address',
    'emergencyContact',
    'secondaryTeam',
    'workLocation',
    'notes',
    'clientCompany',
    'vendorCompany',
    'vendorType',
    'serviceType',
    'linkedClient',
    'linkedProjects',
    'linkedTasks',
    'assignedManager',
    'contractStartDate',
    'contractEndDate',
    'gstTaxDetails',
    'permissionOverrides',
  ];
  assignable.forEach((field) => {
    if (payload[field] !== undefined) next[field] = payload[field];
  });
  if (!next.name || !next.email) throw new Error('Name and email are required');
  if (next.accountStatus && !ACCOUNT_STATUSES.includes(next.accountStatus))
    throw new Error('Invalid account status');
  if (validated.userType === 'employee' && !next.employeeId && !existingUser?.employeeId)
    throw new Error('Employee ID is required for employees');
  return next;
};

const createUser = async ({ payload, actor, req }) => {
  const next = await buildUserPayload({ payload, actor });
  if (await User.exists({ email: next.email })) throw new Error('Email already in use');
  if (next.employeeId && (await User.exists({ employeeId: String(next.employeeId).toUpperCase() })))
    throw new Error('Employee ID already in use');
  let password = payload.password;
  if (!password && payload.sendInvitation) password = crypto.randomBytes(24).toString('base64url');
  if (!password || password.length < 8)
    throw new Error('Password must be at least 8 characters or Send Invitation must be selected');
  next.password = await bcrypt.hash(password, 10);
  next.passwordChangedAt = new Date();
  if (payload.sendInvitation) {
    next.accountStatus = 'invited';
    next.invitationSentAt = new Date();
  }
  const user = await User.create(next);
  await writeAuditLog({
    req,
    targetUserId: user._id,
    action: 'user_created',
    resource: 'users',
    resourceId: user._id,
    newValue: user.toObject(),
    communityKey: user.primaryCommunity,
  });
  return User.findById(user._id).select(publicUserFields);
};

const updateUser = async ({ userId, payload, actor, req }) => {
  const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } }).select('+password');
  if (!user) throw new Error('User not found');
  if (user.roleKey === 'super_admin' && actor.roleKey !== 'super_admin') {
    const error = new Error('Super Admin cannot be modified');
    error.status = 403;
    throw error;
  }
  const previous = user.toObject();
  const next = await buildUserPayload({ payload, actor, existingUser: user });
  if (
    next.email !== user.email &&
    (await User.exists({ email: next.email, _id: { $ne: user._id } }))
  )
    throw new Error('Email already in use');
  if (
    next.employeeId &&
    (await User.exists({
      employeeId: String(next.employeeId).toUpperCase(),
      _id: { $ne: user._id },
    }))
  )
    throw new Error('Employee ID already in use');
  Object.assign(user, next);
  if (payload.password) {
    if (payload.password.length < 8) throw new Error('Password must be at least 8 characters');
    user.password = await bcrypt.hash(payload.password, 10);
    user.passwordChangedAt = new Date();
  }
  user.sessionVersion = (user.sessionVersion || 0) + 1;
  await user.save();
  await writeAuditLog({
    req,
    targetUserId: user._id,
    action: 'user_edited',
    resource: 'users',
    resourceId: user._id,
    previousValue: previous,
    newValue: user.toObject(),
    communityKey: user.primaryCommunity,
  });
  return User.findById(user._id).select(publicUserFields);
};

module.exports = {
  publicUserFields,
  normalizeCommunities,
  normalizePhone,
  validateUserInput,
  createUser,
  updateUser,
};
