const User = require('../models/User');
const WebsiteEnquiry = require('../models/WebsiteEnquiry');
const { createNotification } = require('../utils/notifications');
const {
  resolveEffectivePermissions,
  getPermission,
  buildScopeQuery,
} = require('./accessControlService');

// Use the same permission and record scope as the enquiry list API.
const notifyWebsiteEnquiry = async ({ enquiry, actor = null }) => {
  const event = enquiry.activity?.[enquiry.activity.length - 1];
  if (!event?._id) return;
  try {
    const users = await User.find({ accountStatus: 'active', isDeleted: { $ne: true } })
      .select(
        '_id name email role roleKey crmRole communities officeModule team linkedProjects permissionOverrides',
      )
      .lean();
    for (const user of users) {
      try {
        user.roleKey =
          user.role === 'admin'
            ? 'super_admin'
            : user.crmRole && user.crmRole !== 'employee'
              ? user.crmRole
              : user.roleKey;
        if (user.roleKey !== 'super_admin' && !user.communities?.includes(enquiry.communityKey))
          continue;
        const permission = getPermission(
          await resolveEffectivePermissions(user),
          'website_enquiries',
          'view',
        );
        if (!permission) continue;
        const accessible = await WebsiteEnquiry.exists({
          $and: [
            { _id: enquiry._id, communityKey: enquiry.communityKey },
            buildScopeQuery(user, permission.scope),
          ],
        });
        if (!accessible) continue;
        const actorName = event.changedByName || actor?.name || actor?.email || 'BrainADZ Website';
        const changes = [
          event.previousStatus !== event.currentStatus && event.currentStatus
            ? `${event.previousStatus || 'Pending'} to ${event.currentStatus}`
            : '',
          event.previousRemark !== event.currentRemark && event.currentRemark
            ? `Remark: ${event.currentRemark}`
            : '',
        ]
          .filter(Boolean)
          .join('. ');
        await createNotification({
          communityKey: enquiry.communityKey,
          dedupeKey: `website-enquiry:${enquiry._id}:${event._id}:${user._id}`,
          recipientRole: user.role === 'admin' ? 'admin' : 'employee',
          recipientUser: user._id,
          actorUser: actor?._id || event.changedBy || null,
          actorName,
          actorRole: actor?.role || 'system',
          type: `website_enquiry_${event.type}`,
          title:
            event.type === 'created'
              ? 'New website enquiry'
              : event.type === 'assignment'
                ? 'Enquiry assignment updated'
                : `${actorName} updated an enquiry`,
          message: `${enquiry.enquiryNumber} - ${enquiry.name}: ${event.message}${changes ? `. ${changes}` : ''}`,
          link: `/dashboard/website-enquiries/${enquiry.communityKey}`,
          meta: { enquiryId: enquiry._id, activityId: event._id, status: enquiry.status },
        });
      } catch (error) {
        console.error('Enquiry notification recipient failed:', String(user._id), error.message);
      }
    }
  } catch (error) {
    // A notification outage must not make a saved enquiry look like a failed submission.
    console.error('Enquiry notifications failed:', String(enquiry._id), error.message);
  }
};

module.exports = { notifyWebsiteEnquiry };
