const BusinessUnit = require('../models/BusinessUnit');
const { resolveUserAccess } = require('./organizationAccessService');

const canManageDemoAssignments = (user) =>
  Boolean(user && ['company_admin', 'super_admin'].includes(user.roleKey || user.crmRole));

const canAccessLiveDemoRequests = async (user) => {
  if (!user || user.userType !== 'employee' || user.isDeleted || user.accountStatus !== 'active') {
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

const requireLiveEmployee = async (req, res, next) => {
  try {
    if (!(await canAccessLiveDemoRequests(req.user))) {
      return res
        .status(403)
        .json({ message: 'Demo requests are available to Live employees only.' });
    }
    res.set('Cache-Control', 'no-store');
    return next();
  } catch (error) {
    return next(error);
  }
};

const requireDemoAssignmentManager = (req, res, next) => {
  if (!canManageDemoAssignments(req.user))
    return res.status(403).json({ message: 'Only Admin or Super Admin can assign demo requests.' });
  return next();
};

module.exports = { canAccessLiveDemoRequests, canManageDemoAssignments, requireLiveEmployee, requireDemoAssignmentManager };
