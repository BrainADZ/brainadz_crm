const {
  getPermission,
  resolveEffectivePermissions,
  validateSelectedCommunity,
  buildScopeQuery,
  canGrantPermission,
} = require('../services/accessControlService');

const loadAuthorization = async (req, res, next) => {
  try {
    req.effectivePermissions = await resolveEffectivePermissions(req.user);
    const requested = String(req.header('X-Community-Key') || '')
      .trim()
      .toLowerCase();
    const selectedCommunity = validateSelectedCommunity(req.user, requested);
    if (selectedCommunity === false)
      return res.status(403).json({ message: 'Community access denied' });
    req.selectedCommunity = selectedCommunity;
    return next();
  } catch (error) {
    return next(error);
  }
};

const requirePermission = (resource, action) => (req, res, next) => {
  const permission = getPermission(req.effectivePermissions || [], resource, action);
  if (!permission)
    return res.status(403).json({ message: `Access denied: ${resource}.${action} is required` });
  req.permission = permission;
  return next();
};

const applyAccessScope = (resource) => (req, res, next) => {
  const permission =
    req.permission || getPermission(req.effectivePermissions || [], resource, 'view');
  if (!permission)
    return res.status(403).json({ message: `Access denied: ${resource}.view is required` });
  req.accessQuery = buildScopeQuery(req.user, permission.scope, req.selectedCommunity);
  return next();
};

const requireCommunityAccess =
  (field = 'communityKey') =>
  (req, res, next) => {
    const requested = String(
      req.body?.[field] || req.params?.communityKey || req.selectedCommunity || '',
    )
      .trim()
      .toLowerCase();
    if (!requested) return res.status(400).json({ message: 'Community is required' });
    if (req.user.roleKey !== 'super_admin' && !req.user.communities.includes(requested)) {
      return res.status(403).json({ message: 'Cannot manage records outside your communities' });
    }
    req.body[field] = requested;
    return next();
  };

const preventPrivilegeEscalation =
  (permissionsSelector = (req) => req.body.permissions || []) =>
  (req, res, next) => {
    const requested = permissionsSelector(req);
    if (
      req.user.roleKey === 'super_admin' ||
      canGrantPermission(req.effectivePermissions || [], requested)
    )
      return next();
    return res.status(403).json({ message: 'Cannot grant permissions greater than your own' });
  };

module.exports = {
  loadAuthorization,
  requirePermission,
  applyAccessScope,
  requireCommunityAccess,
  preventPrivilegeEscalation,
};
