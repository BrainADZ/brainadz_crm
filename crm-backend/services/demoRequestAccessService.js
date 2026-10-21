const BusinessUnit = require('../models/BusinessUnit');
const { resolveUserAccess } = require('./organizationAccessService');
const { getPermission, resolveEffectivePermissions } = require('./accessControlService');

const canManageDemoAssignments = (user) =>
  Boolean(user && ['company_admin', 'super_admin'].includes(user.roleKey || user.crmRole));

const canAccessLiveDemoRequests = async (user, action = 'view') => {
  if (!user || user.userType !== 'employee' || user.isDeleted || user.accountStatus !== 'active') {
    return false;
  }

  const permissions = await resolveEffectivePermissions(user);
  if (
    !getPermission(permissions, 'demo_requests', 'view') ||
    !getPermission(permissions, 'demo_requests', action)
  ) {
    return false;
  }

  if (canManageDemoAssignments(user)) return true;

  const access = await resolveUserAccess(user._id);
  if (access.bypass) return true;

  const liveUnit = await BusinessUnit.findOne({
    legacyCommunityKey: 'live',
    status: 'active',
  }).lean();

  return Boolean(
    liveUnit && access.businessUnitIds?.some((id) => String(id) === String(liveUnit._id)),
  );
};

const requireDemoPermission = (action) => async (req, res, next) => {
  try {
    if (!(await canAccessLiveDemoRequests(req.user, action))) {
      return res.status(403).json({
        message: `Access denied: Live employee access and demo_requests.${action} permission are required.`,
      });
    }
    res.set('Cache-Control', 'no-store');
    return next();
  } catch (error) {
    return next(error);
  }
};

const requireLiveEmployee = requireDemoPermission('view');

const requireDemoAssignmentManager = (req, res, next) => {
  if (!canManageDemoAssignments(req.user)) {
    return res.status(403).json({ message: 'Only Admin or Super Admin can assign demo requests.' });
  }
  return requireDemoPermission('assign')(req, res, next);
};

module.exports = {
  canAccessLiveDemoRequests,
  canManageDemoAssignments,
  requireLiveEmployee,
  requireDemoPermission,
  requireDemoAssignmentManager,
};
