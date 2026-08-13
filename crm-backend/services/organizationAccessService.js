const BusinessUnit = require('../models/BusinessUnit');
const Department = require('../models/Department');
const OrganizationTeam = require('../models/OrganizationTeam');
const AccessModule = require('../models/AccessModule');
const RolePermission = require('../models/RolePermission');
const UserAccessAssignment = require('../models/UserAccessAssignment');
const UserPermissionOverride = require('../models/UserPermissionOverride');
const User = require('../models/User');
const {
  UNIVERSAL_COMMUNITIES,
  DEPARTMENT_SEEDS,
  MODULES,
  ROLE_TEMPLATES,
  ACTIONS,
  PERMISSION_RESOURCES,
} = require('../config/accessControl');

const DEFAULT_TEAMS = {
  creative: ['Graphic Design Team', 'Video Editing Team', 'Content Team'],
  development: ['Frontend Team', 'Backend Team', 'Full Stack Team', 'QA Team'],
  sales: ['Marketing Sales Team', 'Live Sales Team', 'Exhibits Sales Team'],
};

const ensureAccessFoundation = async () => {
  for (const unit of UNIVERSAL_COMMUNITIES) {
    await BusinessUnit.updateOne(
      { slug: unit.key },
      {
        $setOnInsert: {
          name: unit.name,
          slug: unit.key,
          legacyCommunityKey: unit.key,
          status: 'active',
        },
      },
      { upsert: true },
    );
  }
  const units = await BusinessUnit.find({ status: 'active' }).lean();
  const unitByKey = new Map(units.map((unit) => [unit.slug, unit]));

  for (const seed of DEPARTMENT_SEEDS) {
    const businessUnitIds = seed.businessUnitKeys
      .map((key) => unitByKey.get(key)?._id)
      .filter(Boolean);
    await Department.updateOne(
      { slug: seed.slug },
      {
        $setOnInsert: {
          name: seed.name,
          slug: seed.slug,
          icon: seed.icon,
          description: `${seed.name} department`,
          status: 'active',
          isCompanyWide: Boolean(seed.isCompanyWide),
          businessUnitIds,
          defaultModuleIds: [],
        },
      },
      { upsert: true },
    );
  }

  const departments = await Department.find({ status: 'active' });
  for (const department of departments) {
    for (const teamName of DEFAULT_TEAMS[department.slug] || []) {
      await OrganizationTeam.updateOne(
        { departmentId: department._id, name: teamName },
        {
          $setOnInsert: {
            departmentId: department._id,
            name: teamName,
            businessUnitIds: department.businessUnitIds,
            isCompanyWide: department.isCompanyWide,
            status: 'active',
          },
        },
        { upsert: true },
      );
    }
  }

  for (const [sortOrder, module] of MODULES.entries()) {
    await AccessModule.updateOne(
      { moduleKey: module.key },
      {
        $set: { label: module.label, resources: module.resources, status: 'active', sortOrder },
        $setOnInsert: { moduleKey: module.key },
      },
      { upsert: true },
    );
  }
  await AccessModule.updateMany(
    { moduleKey: { $nin: MODULES.map((module) => module.key) } },
    { $set: { status: 'inactive' } },
  );

  const genericKeys = ROLE_TEMPLATES.map((role) => role.roleKey);
  await RolePermission.updateMany(
    { systemRole: true, roleKey: { $nin: genericKeys }, legacy: { $ne: true } },
    { $set: { legacy: true } },
  );
  for (const template of ROLE_TEMPLATES) {
    if (template.roleKey === 'super_admin') {
      await RolePermission.updateOne(
        { roleKey: template.roleKey },
        { $set: { ...template, legacy: false, locked: true, active: true } },
        { upsert: true, runValidators: true, setDefaultsOnInsert: true },
      );
      continue;
    }
    const existing = await RolePermission.findOneAndUpdate(
      { roleKey: template.roleKey },
      { $setOnInsert: { ...template, legacy: false } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    const missingHierarchy =
      existing.hierarchyLevel === undefined ||
      existing.hierarchyLevel === null ||
      existing.hierarchyLevel === 0;
    if (missingHierarchy || existing.legacy) {
      await RolePermission.updateOne(
        { _id: existing._id },
        { $set: { ...template, legacy: false } },
        { runValidators: true },
      );
    }
  }
};

const getOrganizationWorkspace = async () => {
  await ensureAccessFoundation();
  const [businessUnits, departments, teams, modules, roles] = await Promise.all([
    BusinessUnit.find({ status: 'active' }).sort({ createdAt: 1 }).lean(),
    Department.find().sort({ name: 1 }).lean(),
    OrganizationTeam.find().sort({ name: 1 }).lean(),
    AccessModule.find({ status: 'active' }).sort({ sortOrder: 1 }).lean(),
    RolePermission.find({ legacy: { $ne: true } })
      .sort({ hierarchyLevel: -1, roleLabel: 1 })
      .lean(),
  ]);
  const assignmentStats = await UserAccessAssignment.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: '$departmentId',
        employees: { $addToSet: '$userId' },
        managers: {
          $sum: {
            $cond: [
              {
                $in: [
                  '$dataScope',
                  [
                    'TEAM',
                    'MULTIPLE_TEAMS',
                    'DEPARTMENT',
                    'BUSINESS_UNIT',
                    'MULTIPLE_BUSINESS_UNITS',
                    'COMPANY',
                  ],
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);
  const stats = new Map(
    assignmentStats.map((item) => [
      String(item._id),
      { employeeCount: item.employees.length, managerCount: item.managers },
    ]),
  );
  return {
    businessUnits,
    departments: departments.map((department) => ({
      ...department,
      ...(stats.get(String(department._id)) || { employeeCount: 0, managerCount: 0 }),
    })),
    teams,
    modules,
    roles,
  };
};

const activeAssignmentQuery = (userId, now = new Date()) => ({
  userId,
  status: 'active',
  startDate: { $lte: now },
  $or: [{ endDate: null }, { endDate: { $gte: now } }],
});

const mergePermissions = (sources) => {
  const permissionMap = new Map();
  sources.forEach(({ permissions = [], source }) =>
    permissions.forEach((permission) => {
      const current = permissionMap.get(permission.resource) || {
        resource: permission.resource,
        actions: [],
        deniedActions: [],
        scopes: [],
        sources: [],
      };
      current.actions = [...new Set([...current.actions, ...(permission.actions || [])])];
      if (permission.scope) current.scopes = [...new Set([...current.scopes, permission.scope])];
      current.sources.push(source);
      permissionMap.set(permission.resource, current);
    }),
  );
  return permissionMap;
};

const resolveUserAccess = async (userId) => {
  const user = await User.findById(userId).lean();
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  if (user.roleKey === 'super_admin') {
    const workspace = await getOrganizationWorkspace();
    return {
      bypass: true,
      assignments: [],
      businessUnitIds: workspace.businessUnits.map((item) => item._id),
      departmentIds: workspace.departments.map((item) => item._id),
      teamIds: workspace.teams.map((item) => item._id),
      permissions: PERMISSION_RESOURCES.map((resource) => ({
        resource,
        actions: [...ACTIONS],
        deniedActions: [],
        scopes: ['COMPANY'],
        sources: ['Super Admin bypass'],
      })),
      visibleModules: workspace.modules.map((module) => module.moduleKey),
      conflicts: [],
    };
  }

  let assignments = await UserAccessAssignment.find(activeAssignmentQuery(userId))
    .populate('roleId')
    .lean();
  if (!assignments.length) {
    const role = await RolePermission.findOne({
      roleKey: user.roleKey || user.crmRole || 'employee',
      active: true,
    }).lean();
    const businessUnits = await BusinessUnit.find({
      legacyCommunityKey: { $in: user.communities || [] },
    }).lean();
    assignments = role
      ? [
          {
            _id: 'legacy',
            roleId: role,
            businessUnitIds: businessUnits.map((item) => item._id),
            teamIds: [],
            departmentId: null,
            dataScope: role.defaultDataScope || 'ASSIGNED',
            modulePermissionOverrides: [],
            source: 'Legacy user compatibility',
          },
        ]
      : [];
  }

  // A role defines what a person can do. A department defines which CRM modules
  // are relevant there. Apply both, so one shared "Manager" role can be used for
  // Sales, Development, etc. without exposing unrelated modules.
  const assignmentDepartmentIds = assignments
    .map((assignment) => assignment.departmentId && String(assignment.departmentId))
    .filter(Boolean);
  const assignedDepartments = assignmentDepartmentIds.length
    ? await Department.find({ _id: { $in: assignmentDepartmentIds }, status: 'active' }).lean()
    : [];
  const departmentModuleKeys = new Set(
    assignedDepartments.flatMap((department) => department.defaultModuleIds || []),
  );
  const hasDepartmentModuleRestriction = assignmentDepartmentIds.length > 0;
  const allowedResources = new Set(
    MODULES.filter(
      (module) => !hasDepartmentModuleRestriction || departmentModuleKeys.has(module.key),
    ).flatMap((module) => module.resources),
  );

  const permissionMap = mergePermissions(
    assignments.map((assignment) => ({
      permissions: (assignment.roleId?.permissions || []).map((permission) => ({
        ...permission,
        scope:
          assignment.dataScope ||
          permission.scope ||
          assignment.roleId?.defaultDataScope ||
          'ASSIGNED',
      })),
      source: `Role: ${assignment.roleId?.roleLabel || 'Unknown'}`,
    })),
  );
  assignments.forEach((assignment) =>
    (assignment.modulePermissionOverrides || []).forEach((override) => {
      const current = permissionMap.get(override.resource) || {
        resource: override.resource,
        actions: [],
        deniedActions: [],
        scopes: [assignment.dataScope],
        sources: [],
      };
      current.actions = [...new Set([...current.actions, ...(override.allow || [])])];
      current.deniedActions = [...new Set([...current.deniedActions, ...(override.deny || [])])];
      current.sources.push('Assignment override');
      permissionMap.set(override.resource, current);
    }),
  );

  const userOverrides = await UserPermissionOverride.find({ userId, status: 'active' }).lean();
  userOverrides.forEach((override) => {
    const current = permissionMap.get(override.resource) || {
      resource: override.resource,
      actions: [],
      deniedActions: [],
      scopes: [],
      sources: [],
    };
    current.actions = [...new Set([...current.actions, ...(override.allowActions || [])])];
    current.deniedActions = [
      ...new Set([...current.deniedActions, ...(override.denyActions || [])]),
    ];
    current.sources.push('User override');
    permissionMap.set(override.resource, current);
  });
  permissionMap.forEach((permission) => {
    permission.actions = permission.actions.filter(
      (action) => !permission.deniedActions.includes(action),
    );
    // Resources which belong to an unselected department module must not be
    // callable directly by URL/API either.
    if (PERMISSION_RESOURCES.includes(permission.resource) && !allowedResources.has(permission.resource)) {
      permission.actions = [];
    }
  });

  const modules = await AccessModule.find({ status: 'active' }).lean();
  const permissions = [...permissionMap.values()];
  return {
    bypass: false,
    assignments,
    businessUnitIds: [
      ...new Set(assignments.flatMap((item) => (item.businessUnitIds || []).map(String))),
    ],
    departmentIds: [
      ...new Set(
        assignments.map((item) => item.departmentId && String(item.departmentId)).filter(Boolean),
      ),
    ],
    teamIds: [...new Set(assignments.flatMap((item) => (item.teamIds || []).map(String)))],
    permissions: permissions.filter((permission) => permission.actions.length),
    visibleModules: modules
      .filter((module) =>
        (!hasDepartmentModuleRestriction || departmentModuleKeys.has(module.moduleKey)) &&
        module.resources.some((resource) =>
          permissions.some(
            (permission) => permission.resource === resource && permission.actions.includes('view'),
          ),
        ),
      )
      .map((module) => module.moduleKey),
    conflicts: permissions
      .filter((permission) =>
        permission.deniedActions.some((action) => permission.actions.includes(action)),
      )
      .map((permission) => permission.resource),
  };
};

const buildDataScopeFilter = (assignment, userId) => {
  const base = {};
  if (assignment.businessUnitIds?.length) base.businessUnitId = { $in: assignment.businessUnitIds };
  if (assignment.dataScope === 'OWN') return { ...base, ownerUserId: userId };
  if (assignment.dataScope === 'ASSIGNED') return { ...base, assignedToUserIds: userId };
  if (['TEAM', 'MULTIPLE_TEAMS'].includes(assignment.dataScope))
    return { ...base, teamId: { $in: assignment.teamIds || [] } };
  if (assignment.dataScope === 'DEPARTMENT')
    return { ...base, departmentId: assignment.departmentId };
  if (['BUSINESS_UNIT', 'MULTIPLE_BUSINESS_UNITS'].includes(assignment.dataScope)) return base;
  if (assignment.dataScope === 'COMPANY') return {};
  return { _id: null };
};

module.exports = {
  ensureAccessFoundation,
  getOrganizationWorkspace,
  resolveUserAccess,
  buildDataScopeFilter,
};
