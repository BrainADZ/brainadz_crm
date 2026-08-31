const BusinessUnit = require('../models/BusinessUnit');
const Department = require('../models/Department');
const OrganizationTeam = require('../models/OrganizationTeam');
const RolePermission = require('../models/RolePermission');
const UserAccessAssignment = require('../models/UserAccessAssignment');
const User = require('../models/User');
const { ACTIONS, DATA_SCOPES, PERMISSION_RESOURCES } = require('../config/accessControl');
const { SCOPE_RANK, canGrantPermission } = require('./accessControlService');

const accessError = (message, status = 400) => Object.assign(new Error(message), { status });
const uniqueIds = (values = []) => [...new Set(values.map(String).filter(Boolean))];

const validateAccessAssignments = async (
  inputs,
  { actor, effectivePermissions = [], targetUserType = 'employee', ensurePrimary = true },
) => {
  if (!Array.isArray(inputs) || !inputs.length)
    throw accessError('Add at least one access assignment');

  const actorRole =
    actor.roleKey === 'super_admin'
      ? null
      : await RolePermission.findOne({ roleKey: actor.roleKey, active: true }).lean();
  if (actor.roleKey !== 'super_admin' && !actorRole)
    throw accessError('Your active role could not be resolved', 403);

  const normalized = [];
  for (const [index, input] of inputs.entries()) {
    const rowLabel = `Access row ${index + 1}`;
    const businessUnitIds = uniqueIds(input.businessUnitIds);
    const teamIds = uniqueIds(input.teamIds);
    const [department, role, units, teams] = await Promise.all([
      Department.findOne({ _id: input.departmentId, status: 'active' }),
      RolePermission.findOne({ _id: input.roleId, active: true, legacy: { $ne: true } }),
      BusinessUnit.find({ _id: { $in: businessUnitIds }, status: 'active' }),
      OrganizationTeam.find({ _id: { $in: teamIds }, status: 'active' }),
    ]);

    if (!department || !role)
      throw accessError(`${rowLabel} has an invalid department or role`);
    if (!role.allowedUserTypes?.includes(targetUserType))
      throw accessError(`${role.roleLabel} cannot be assigned to a ${targetUserType}`);
    if (!businessUnitIds.length || units.length !== businessUnitIds.length)
      throw accessError(`${rowLabel} requires valid Business Units`);
    if (businessUnitIds.some((id) => !department.businessUnitIds.map(String).includes(id)))
      throw accessError(`${rowLabel} uses a Business Unit outside the department`);
    if (
      teams.length !== teamIds.length ||
      teams.some(
        (team) =>
          String(team.departmentId) !== String(department._id) ||
          !team.businessUnitIds.some((id) => businessUnitIds.includes(String(id))),
      )
    )
      throw accessError(`${rowLabel} has an invalid team selection`);
    if (!DATA_SCOPES.includes(input.dataScope))
      throw accessError(`${rowLabel} has an invalid data scope`);
    if ((SCOPE_RANK[input.dataScope] || 0) > (SCOPE_RANK[role.defaultDataScope] || 0))
      throw accessError(
        `${role.roleLabel} cannot be assigned beyond ${role.defaultDataScope.replaceAll('_', ' ')}`,
      );
    if (['TEAM', 'MULTIPLE_TEAMS'].includes(input.dataScope) && !teamIds.length)
      throw accessError(`${rowLabel} requires at least one team for ${input.dataScope}`);

    const assignableDepartmentIds = role.assignableDepartmentIds?.map(String) || [];
    const assignableBusinessUnitIds = role.assignableBusinessUnitIds?.map(String) || [];
    const assignableTeamIds = role.assignableTeamIds?.map(String) || [];
    if (
      assignableDepartmentIds.length &&
      !assignableDepartmentIds.includes(String(department._id))
    )
      throw accessError(`${role.roleLabel} cannot be assigned to ${department.name}`);
    if (
      assignableBusinessUnitIds.length &&
      businessUnitIds.some((id) => !assignableBusinessUnitIds.includes(id))
    )
      throw accessError(`${rowLabel} uses a Business Unit outside the role's assignment rules`);
    if (assignableTeamIds.length && teamIds.some((id) => !assignableTeamIds.includes(id)))
      throw accessError(`${rowLabel} uses a team outside the role's assignment rules`);

    if (actor.roleKey !== 'super_admin') {
      if (role.hierarchyLevel >= actorRole.hierarchyLevel)
        throw accessError('You cannot assign a role at or above your own hierarchy level', 403);
      const scopedPermissions = (role.permissions || []).map((permission) => ({
        ...permission.toObject?.() || permission,
        scope: input.dataScope,
      }));
      if (!canGrantPermission(effectivePermissions, scopedPermissions))
        throw accessError('You cannot assign permissions greater than your own', 403);
    }

    const modulePermissionOverrides = (input.modulePermissionOverrides || [])
      .filter((override) => PERMISSION_RESOURCES.includes(override.resource))
      .map((override) => ({
        resource: override.resource,
        allow: [...new Set((override.allow || []).filter((action) => ACTIONS.includes(action)))],
        deny: [...new Set((override.deny || []).filter((action) => ACTIONS.includes(action)))],
      }));
    if (
      actor.roleKey !== 'super_admin' &&
      !canGrantPermission(
        effectivePermissions,
        modulePermissionOverrides
          .filter((override) => override.allow.length)
          .map((override) => ({
            resource: override.resource,
            actions: override.allow,
            scope: input.dataScope,
          })),
      )
    )
      throw accessError('You cannot add assignment overrides greater than your own', 403);

    normalized.push({
      businessUnitIds,
      departmentId: department._id,
      teamIds,
      roleId: role._id,
      dataScope: input.dataScope,
      isPrimary: Boolean(input.isPrimary),
      modulePermissionOverrides,
      status: ['active', 'inactive', 'scheduled', 'expired'].includes(input.status)
        ? input.status
        : 'active',
      startDate: input.startDate || new Date(),
      endDate: input.endDate || null,
    });
  }

  if (ensurePrimary) {
    if (!normalized.some((assignment) => assignment.isPrimary)) normalized[0].isPrimary = true;
    if (normalized.filter((assignment) => assignment.isPrimary).length > 1)
      throw accessError('Only one access assignment can be primary');
  }
  return normalized;
};

const syncUserPrimaryAccess = async (userId) => {
  let primary = await UserAccessAssignment.findOne({
    userId,
    status: 'active',
    startDate: { $lte: new Date() },
    $or: [{ endDate: null }, { endDate: { $gte: new Date() } }],
  })
    .sort({ isPrimary: -1, createdAt: 1 })
    .populate('roleId')
    .populate('departmentId')
    .populate('businessUnitIds')
    .populate('teamIds');

  if (!primary) {
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          role: 'employee',
          roleKey: 'employee',
          crmRole: 'employee',
          communities: [],
          primaryCommunity: null,
          officeModule: '',
          team: '',
          accessAssignmentsInitialized: true,
        },
        $inc: { sessionVersion: 1 },
      },
    );
    return null;
  }

  if (!primary.isPrimary) {
    primary.isPrimary = true;
    await primary.save();
  }
  const allUnits = await UserAccessAssignment.find({ userId, status: 'active' })
    .select('businessUnitIds')
    .lean();
  const businessUnits = await BusinessUnit.find({
    _id: { $in: uniqueIds(allUnits.flatMap((assignment) => assignment.businessUnitIds || [])) },
  }).lean();
  const communities = [
    ...new Set(businessUnits.map((unit) => unit.legacyCommunityKey).filter(Boolean)),
  ];
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        role: primary.roleId.roleKey === 'super_admin' ? 'admin' : 'employee',
        roleKey: primary.roleId.roleKey,
        crmRole: primary.roleId.roleKey,
        communities,
        primaryCommunity: communities[0] || null,
        officeModule: primary.departmentId?.name || '',
        team: primary.teamIds?.[0]?.name || '',
        accessAssignmentsInitialized: true,
      },
      $inc: { sessionVersion: 1 },
    },
  );
  return primary;
};

module.exports = { uniqueIds, validateAccessAssignments, syncUserPrimaryAccess };
