const RolePermission = require('../models/RolePermission');
const {
  ACTIONS,
  PERMISSION_RESOURCES,
  COMMUNITY_KEYS,
  MODULES,
} = require('../config/accessControl');
const { resolveUserAccess } = require('./organizationAccessService');

const SCOPE_RANK = {
  none: 0,
  self: 1,
  OWN: 1,
  linked: 1,
  assigned: 2,
  ASSIGNED: 2,
  team: 3,
  TEAM: 3,
  MULTIPLE_TEAMS: 4,
  department: 5,
  DEPARTMENT: 5,
  community: 6,
  BUSINESS_UNIT: 6,
  MULTIPLE_BUSINESS_UNITS: 7,
  all: 8,
  COMPANY: 8,
};

const legacyModulesToPermissions = (modules = []) =>
  modules.flatMap((moduleKey) => {
    const module = MODULES.find((item) => item.key === moduleKey);
    return (module?.resources || []).map((resource) => ({
      resource,
      actions: ['view'],
      scope: 'community',
    }));
  });

const normalizePermission = (permission) => ({
  resource: String(permission?.resource || '').trim(),
  actions: [...new Set((permission?.actions || []).filter((action) => ACTIONS.includes(action)))],
  scope: permission?.scope || 'none',
});

const mergeAllows = (permissions) => {
  const result = new Map();
  permissions
    .map(normalizePermission)
    .filter((item) => item.resource)
    .forEach((item) => {
      const current = result.get(item.resource) || {
        resource: item.resource,
        actions: [],
        scope: 'none',
        source: 'role',
      };
      current.actions = [...new Set([...current.actions, ...item.actions])];
      if ((SCOPE_RANK[item.scope] || 0) > (SCOPE_RANK[current.scope] || 0))
        current.scope = item.scope;
      result.set(item.resource, current);
    });
  return result;
};

const resolveEffectivePermissions = async (user) => {
  if (user.roleKey === 'super_admin' || user.crmRole === 'super_admin') {
    return PERMISSION_RESOURCES.map((resource) => ({
      resource,
      actions: [...ACTIONS],
      scope: 'all',
      source: 'super_admin',
    }));
  }

  const assignmentAccess = await resolveUserAccess(user._id || user.id);
  if (assignmentAccess.assignments?.length && assignmentAccess.assignments[0]?._id !== 'legacy') {
    return assignmentAccess.permissions.map((permission) => ({
      resource: permission.resource,
      actions: permission.actions,
      deniedActions: permission.deniedActions,
      scope:
        [...(permission.scopes || [])].sort(
          (left, right) => (SCOPE_RANK[right] || 0) - (SCOPE_RANK[left] || 0),
        )[0] || 'ASSIGNED',
      source: permission.sources?.join(', ') || 'assignment',
    }));
  }

  const roleKey = user.roleKey || user.crmRole || 'employee';
  const role = await RolePermission.findOne({ roleKey, active: true }).lean();
  const rolePermissions = role?.permissions?.length
    ? role.permissions
    : legacyModulesToPermissions(role?.modules);
  const effective = mergeAllows(rolePermissions || []);

  (user.permissionOverrides?.allow || []).map(normalizePermission).forEach((item) => {
    const current = effective.get(item.resource) || {
      resource: item.resource,
      actions: [],
      scope: 'none',
    };
    current.actions = [...new Set([...current.actions, ...item.actions])];
    if ((SCOPE_RANK[item.scope] || 0) > (SCOPE_RANK[current.scope] || 0))
      current.scope = item.scope;
    current.source = 'user_allow_override';
    effective.set(item.resource, current);
  });

  (user.permissionOverrides?.deny || []).map(normalizePermission).forEach((item) => {
    const current = effective.get(item.resource) || {
      resource: item.resource,
      actions: [],
      scope: 'none',
    };
    current.actions = current.actions.filter((action) => !item.actions.includes(action));
    if (!current.actions.length) current.scope = 'none';
    current.source = 'user_deny_override';
    current.deniedActions = [...new Set([...(current.deniedActions || []), ...item.actions])];
    effective.set(item.resource, current);
  });

  return [...effective.values()];
};

const getPermission = (effectivePermissions, resource, action) => {
  const permission = effectivePermissions.find((item) => item.resource === resource);
  if (!permission || permission.scope === 'none' || !permission.actions.includes(action))
    return null;
  if (permission.deniedActions?.includes(action)) return null;
  return permission;
};

const validateSelectedCommunity = (user, requestedCommunity) => {
  if (!requestedCommunity || requestedCommunity === 'all') return null;
  if (!COMMUNITY_KEYS.includes(requestedCommunity)) return null;
  if (user.roleKey === 'super_admin' || user.communities.includes(requestedCommunity))
    return requestedCommunity;
  return false;
};

const getAuthorizedCommunities = (user, selectedCommunity = null) => {
  const communities = user.roleKey === 'super_admin' ? COMMUNITY_KEYS : user.communities || [];
  return selectedCommunity ? communities.filter((key) => key === selectedCommunity) : communities;
};

const buildScopeQuery = (user, scope, selectedCommunity = null) => {
  if (['all', 'COMPANY'].includes(scope) && !selectedCommunity) return {};
  const communityKeys = getAuthorizedCommunities(user, selectedCommunity);
  const communityQuery = { communityKey: { $in: communityKeys } };

  if (['all', 'community', 'BUSINESS_UNIT', 'MULTIPLE_BUSINESS_UNITS'].includes(scope))
    return communityQuery;
  if (['department', 'DEPARTMENT'].includes(scope))
    return {
      ...communityQuery,
      $or: [{ officeModule: user.officeModule }, { department: user.officeModule }],
    };
  if (['team', 'TEAM', 'MULTIPLE_TEAMS'].includes(scope))
    return { ...communityQuery, team: user.team };
  if (['self', 'OWN'].includes(scope))
    return {
      ...communityQuery,
      $or: [{ _id: user._id }, { user: user._id }, { employee: user._id }, { createdBy: user._id }],
    };
  if (['assigned', 'ASSIGNED'].includes(scope))
    return {
      ...communityQuery,
      $or: [
        { assignedTo: user._id },
        { assigneeUser: user._id },
        { assignedUserIds: user._id },
        { memberUserIds: user._id },
        { createdBy: user._id },
        { ownerUser: user._id },
        { assigneeEmail: user.email },
        { ownerEmail: user.email },
      ],
    };
  if (scope === 'linked')
    return {
      ...communityQuery,
      $or: [
        { linkedUserIds: user._id },
        { clientUserIds: user._id },
        { vendorUserIds: user._id },
        { _id: { $in: user.linkedProjects || [] } },
        { project: { $in: user.linkedProjects || [] } },
        { assignedTo: user._id },
      ],
    };
  return { _id: null };
};

const canGrantPermission = (actorPermissions, requestedPermissions) =>
  requestedPermissions.every((requested) =>
    requested.actions.every((action) => {
      const actorPermission = getPermission(actorPermissions, requested.resource, action);
      return (
        actorPermission &&
        (SCOPE_RANK[actorPermission.scope] || 0) >= (SCOPE_RANK[requested.scope] || 0)
      );
    }),
  );

module.exports = {
  SCOPE_RANK,
  normalizePermission,
  resolveEffectivePermissions,
  getPermission,
  validateSelectedCommunity,
  getAuthorizedCommunities,
  buildScopeQuery,
  canGrantPermission,
};
