const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const RolePermission = require('../models/RolePermission');
const Community = require('../models/Community');
const AuditLog = require('../models/AuditLog');
const BusinessCampaign = require('../models/BusinessCampaign');
const BusinessProject = require('../models/BusinessProject');
const BusinessProjectTask = require('../models/BusinessProjectTask');
const Client = require('../models/Client');
const ClientDataset = require('../models/ClientDataset');
const CommunicationLog = require('../models/CommunicationLog');
const DocumentRecord = require('../models/DocumentRecord');
const FinanceRecord = require('../models/FinanceRecord');
const Meeting = require('../models/Meeting');
const {
  ROLE_TEMPLATES,
  UNIVERSAL_COMMUNITIES,
  COMMUNITY_KEYS,
  MODULES,
} = require('../config/accessControl');

dotenv.config();

const warnings = [];
const warn = (message) => {
  warnings.push(message);
  console.warn(`MIGRATION WARNING: ${message}`);
};
const inferCommunity = (value = '') => {
  const normalized = String(value).toLowerCase();
  if (normalized.includes('market')) return 'marketing';
  if (
    normalized.includes('exhibition') ||
    normalized.includes('operation') ||
    normalized.includes('stall')
  )
    return 'exhibition';
  return 'live';
};

const migrateRoles = async () => {
  for (const template of ROLE_TEMPLATES) {
    await RolePermission.updateOne(
      { roleKey: template.roleKey },
      { $set: { ...template, systemRole: true } },
      { upsert: true, runValidators: true },
    );
  }
  await RolePermission.deleteOne({ roleKey: 'admin' });
};

const migrateCommunities = async () => {
  for (const community of UNIVERSAL_COMMUNITIES) {
    await Community.updateOne(
      { key: community.key },
      { $set: { ...community, active: true } },
      { upsert: true },
    );
  }
};

const migrateUsers = async () => {
  const users = await User.find().select('+password +securityAnswerHash');
  const validModules = new Map(MODULES.map((module) => [module.key, module]));
  for (const user of users) {
    const legacyRole =
      user.roleKey || user.crmRole || (user.role === 'admin' ? 'super_admin' : 'employee');
    const knownRole = ROLE_TEMPLATES.some((role) => role.roleKey === legacyRole);
    if (!knownRole) {
      warn(
        `User ${user.email} keeps unknown legacy role key "${legacyRole}"; a restricted custom role was created.`,
      );
      await RolePermission.updateOne(
        { roleKey: legacyRole },
        {
          $setOnInsert: {
            roleKey: legacyRole,
            roleLabel: legacyRole,
            description: 'Migrated legacy role',
            allowedUserTypes: [user.userType || 'employee'],
            permissions: [],
            defaultScope: 'none',
            active: true,
          },
        },
        { upsert: true },
      );
    }
    user.roleKey = user.role === 'admin' ? 'super_admin' : legacyRole;
    user.crmRole = user.roleKey;
    user.userType = user.userType || 'employee';
    user.accountStatus = user.accountStatus || 'active';

    const existingCommunities = (
      Array.isArray(user.communities) ? user.communities : [user.communities]
    ).filter((key) => COMMUNITY_KEYS.includes(key));
    if (user.roleKey === 'super_admin') user.communities = COMMUNITY_KEYS;
    else if (existingCommunities.length) user.communities = [...new Set(existingCommunities)];
    else {
      const fallback = inferCommunity(
        `${user.officeModule || ''} ${user.department || ''} ${user.team || ''}`,
      );
      user.communities = [fallback];
      warn(
        `User ${user.email} had no valid community and was conservatively assigned to ${fallback}.`,
      );
    }
    user.primaryCommunity = user.communities.includes(user.primaryCommunity)
      ? user.primaryCommunity
      : user.communities[0];

    if (user.userType === 'employee' && !user.employeeId) {
      user.employeeId = `LEGACY-${String(user._id).slice(-8).toUpperCase()}`;
      warn(`Generated employee ID ${user.employeeId} for ${user.email}.`);
    }

    const legacyPermissions = [...new Set(user.permissions || [])];
    const knownPermissions = legacyPermissions.filter((key) => validModules.has(key));
    const unknownPermissions = legacyPermissions.filter((key) => !validModules.has(key));
    if (knownPermissions.length && !(user.permissionOverrides?.allow || []).length) {
      user.permissionOverrides = user.permissionOverrides || { allow: [], deny: [] };
      user.permissionOverrides.allow = knownPermissions.flatMap((moduleKey) =>
        validModules
          .get(moduleKey)
          .resources.map((resource) => ({ resource, actions: ['view'], scope: 'community' })),
      );
    }
    user.legacyPermissions = [
      ...new Set([...(user.legacyPermissions || []), ...unknownPermissions]),
    ];
    if (unknownPermissions.length)
      warn(`Preserved unknown permissions for ${user.email}: ${unknownPermissions.join(', ')}.`);
    await user.save({ validateModifiedOnly: true });
  }
};

const setCommunityFromUser = async (Model, label, fallback = 'live', userField = 'createdBy') => {
  const records = await Model.find({
    $or: [{ communityKey: { $exists: false } }, { communityKey: '' }, { communityKey: null }],
  });
  for (const record of records) {
    const owner = record[userField]
      ? await User.findById(record[userField]).select('primaryCommunity')
      : null;
    record.communityKey = owner?.primaryCommunity || fallback;
    if (!owner)
      warn(
        `${label} ${record._id} lacked unambiguous ownership; assigned to ${record.communityKey}.`,
      );
    await record.save({ validateModifiedOnly: true });
  }
};

const migrateRecords = async () => {
  await setCommunityFromUser(BusinessCampaign, 'Campaign', 'marketing');
  await setCommunityFromUser(BusinessProject, 'Project', 'live');
  await setCommunityFromUser(BusinessProjectTask, 'Project task', 'live');
  await setCommunityFromUser(Client, 'Client', 'live');
  await setCommunityFromUser(ClientDataset, 'Client dataset', 'live', 'uploadedBy');
  await setCommunityFromUser(CommunicationLog, 'Communication', 'live');
  await setCommunityFromUser(DocumentRecord, 'Document', 'live');
  await setCommunityFromUser(FinanceRecord, 'Finance record', 'live');
  await setCommunityFromUser(Meeting, 'Meeting', 'live', 'employee');
};

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(process.env.MONGODB_URI);
  await migrateCommunities();
  await migrateRoles();
  await migrateUsers();
  await migrateRecords();
  await AuditLog.create({
    action: 'rbac_migration_completed',
    resource: 'system',
    previousValue: null,
    newValue: { warnings: warnings.length },
    metadata: { warnings },
  });
  console.log(`RBAC migration completed with ${warnings.length} warning(s).`);
};

run()
  .catch((error) => {
    console.error(`RBAC migration failed: ${error.stack || error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.connection.close());
