require('dotenv').config();
const mongoose = require('mongoose');
const RolePermission = require('../models/RolePermission');
const User = require('../models/User');
const UserAccessAssignment = require('../models/UserAccessAssignment');
const {
  ensureAccessFoundation,
  getOrganizationWorkspace,
} = require('../services/organizationAccessService');
const { ROLE_TEMPLATES, DATA_SCOPES } = require('../config/accessControl');

const DATA_SCOPE_RANK = Object.fromEntries(DATA_SCOPES.map((scope, index) => [scope, index + 1]));

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  await ensureAccessFoundation();
  const companyAdminTemplate = ROLE_TEMPLATES.find((role) => role.roleKey === 'company_admin');
  await RolePermission.updateOne(
    { roleKey: 'company_admin', 'permissions.resource': { $ne: 'permissions' } },
    {
      $set: {
        permissions: companyAdminTemplate.permissions,
        defaultScope: companyAdminTemplate.defaultScope,
        defaultDataScope: companyAdminTemplate.defaultDataScope,
      },
    },
  );
  const workspace = await getOrganizationWorkspace();
  const canonicalRoleKeys = new Set(workspace.roles.map((role) => role.roleKey));
  const incompleteUsers = await User.find({
    isDeleted: { $ne: true },
    $or: [
      { roleKey: { $exists: false } },
      { roleKey: null },
      { roleKey: '' },
      { crmRole: { $exists: false } },
      { userType: { $exists: false } },
      { accountStatus: { $exists: false } },
    ],
  })
    .select('role roleKey crmRole userType accountStatus sessionVersion')
    .lean();
  for (const user of incompleteUsers) {
    const fallbackRole =
      user.role === 'admin'
        ? 'super_admin'
        : canonicalRoleKeys.has(user.crmRole)
          ? user.crmRole
          : 'employee';
    const roleKey = canonicalRoleKeys.has(user.roleKey) ? user.roleKey : fallbackRole;
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          roleKey,
          crmRole: roleKey,
          role: roleKey === 'super_admin' ? 'admin' : 'employee',
          userType: user.userType || 'employee',
          accountStatus: user.accountStatus || 'active',
        },
        $inc: { sessionVersion: 1 },
      },
    );
  }
  const activeAssignments = await UserAccessAssignment.find({ status: 'active' })
    .populate('roleId', 'defaultDataScope')
    .lean();
  let normalizedAssignments = 0;
  for (const assignment of activeAssignments) {
    if (!assignment.roleId) continue;
    if (
      (DATA_SCOPE_RANK[assignment.dataScope] || 0) >
      (DATA_SCOPE_RANK[assignment.roleId.defaultDataScope] || 0)
    ) {
      await UserAccessAssignment.updateOne(
        { _id: assignment._id },
        { $set: { dataScope: assignment.roleId.defaultDataScope } },
      );
      await User.updateOne(
        { _id: assignment.userId },
        { $set: { accessAssignmentsInitialized: true }, $inc: { sessionVersion: 1 } },
      );
      normalizedAssignments += 1;
    } else {
      await User.updateOne(
        { _id: assignment.userId },
        { $set: { accessAssignmentsInitialized: true } },
      );
    }
  }
  const legacyRoles = await RolePermission.countDocuments({ legacy: true });
  const legacyUsers = await User.countDocuments({
    isDeleted: { $ne: true },
    roleKey: { $nin: workspace.roles.map((role) => role.roleKey) },
  });
  console.log('Organization access migration completed.');
  console.log(`Business Units: ${workspace.businessUnits.length}`);
  console.log(`Departments: ${workspace.departments.length}`);
  console.log(`Teams: ${workspace.teams.length}`);
  console.log(`Primary roles: ${workspace.roles.length}`);
  console.log(`Preserved legacy roles: ${legacyRoles}`);
  console.log(`Normalized legacy users: ${incompleteUsers.length}`);
  console.log(`Normalized assignment scopes: ${normalizedAssignments}`);
  console.log(`Users using legacy compatibility: ${legacyUsers}`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
