require('dotenv').config();
const mongoose = require('mongoose');
const RolePermission = require('../models/RolePermission');

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const roles = await RolePermission.find({
    $or: [{ roleKey: /sales/i }, { roleLabel: /sales/i }],
  });
  let updated = 0;
  for (const role of roles) {
    if (role.permissions.some((permission) => permission.resource === 'quotations')) continue;
    const manager = /manager|head|lead/i.test(`${role.roleKey} ${role.roleLabel}`);
    role.permissions.push({
      resource: 'quotations',
      actions: manager
        ? ['view', 'create', 'update', 'approve', 'download', 'export', 'manage']
        : ['view', 'create', 'update', 'download', 'export'],
      scope: role.defaultScope || role.defaultDataScope || 'ASSIGNED',
    });
    await role.save();
    updated += 1;
  }
  console.log(`Quotation permissions ready for ${roles.length} sales role(s); ${updated} updated.`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
