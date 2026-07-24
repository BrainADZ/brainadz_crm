require('dotenv').config();
const mongoose = require('mongoose');
const RolePermission = require('../models/RolePermission');
const User = require('../models/User');
const {
  ensureAccessFoundation,
  getOrganizationWorkspace,
} = require('../services/organizationAccessService');
const { ROLE_TEMPLATES } = require('../config/accessControl');

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
