const ClientDataset = require('../models/ClientDataset');
const User = require('../models/User');
const UserAccessAssignment = require('../models/UserAccessAssignment');
const BusinessUnit = require('../models/BusinessUnit');
const { createNotification } = require('../utils/notifications');
const { getDateInTimeZone } = require('./meetingReminderService');
const { resolveEffectivePermissions, getPermission } = require('./accessControlService');

let activeRun;
let scheduler;
const id = (value) => String(value?._id || value || '');

const canReceiveReminder = async (user, dataset, now) => {
  if (!getPermission(await resolveEffectivePermissions(user), 'leads', 'view')) return false;
  if (user.roleKey === 'super_admin' || user.crmRole === 'super_admin') return true;
  const assignments = await UserAccessAssignment.find({
    userId: user._id,
    status: 'active',
    startDate: { $lte: now },
    $or: [{ endDate: null }, { endDate: { $gte: now } }],
  })
    .populate('roleId', 'permissions')
    .lean();
  const unitIds = assignments
    .filter((assignment) =>
      assignment.roleId?.permissions?.some(
        (permission) => permission.resource === 'leads' && permission.actions?.includes('view'),
      ),
    )
    .flatMap((assignment) => assignment.businessUnitIds || []);
  if (unitIds.length) {
    return Boolean(
      await BusinessUnit.exists({
        _id: { $in: unitIds },
        status: 'active',
        legacyCommunityKey: dataset.communityKey,
      }),
    );
  }
  return (user.communities || []).includes(dataset.communityKey);
};

// Dependencies can be supplied in tests; production always uses the existing notification store.
const runFollowUpReminders = async ({
  now = new Date(),
  Dataset = ClientDataset,
  Users = User,
  notify = createNotification,
  canReceive = canReceiveReminder,
} = {}) => {
  const today = getDateInTimeZone(now);
  const userCache = new Map();
  const accessCache = new Map();
  const cursor = Dataset.find({
    rowFollowUps: { $elemMatch: { followUpDate: { $gt: '', $lte: today } } },
  })
    .select(
      'name communityKey businessUnitId columns rows rowAssignments rowFollowUps uploadedBy uploaderAssignmentResolved',
    )
    .lean()
    .cursor();
  for await (const dataset of cursor) {
    const statusIndex = dataset.columns.findIndex(
      (column) => String(column).trim().toLowerCase() === 'status',
    );
    const nameIndex = dataset.columns.findIndex((column) =>
      /^(client name|contact person|company name|company \/ organisation)$/i.test(
        String(column).trim(),
      ),
    );
    for (const followUp of dataset.rowFollowUps || []) {
      if (
        !followUp.followUpDate ||
        followUp.followUpDate > today ||
        dataset.rows[followUp.rowIndex]?.[statusIndex] !== 'Follow Up'
      )
        continue;
      const assigned = (dataset.rowAssignments || []).filter(
        (entry) => Number(entry.rowIndex) === Number(followUp.rowIndex),
      );
      // An unassigned lead belongs to its dataset owner; never send to a former assignee.
      const recipients = [
        ...new Set(
          assigned.length ? assigned.map((entry) => id(entry.employee)) : [id(dataset.uploadedBy)],
        ),
      ].filter(Boolean);
      for (const recipientId of recipients) {
        try {
          if (!userCache.has(recipientId))
            userCache.set(
              recipientId,
              await Users.findOne({
                _id: recipientId,
                isDeleted: { $ne: true },
                accountStatus: 'active',
              }).lean(),
            );
          const user = userCache.get(recipientId);
          if (!user) continue;
          const accessKey = `${recipientId}:${dataset.communityKey}`;
          if (!accessCache.has(accessKey))
            accessCache.set(accessKey, await canReceive(user, dataset, now));
          if (!accessCache.get(accessKey)) continue;
          const overdue = followUp.followUpDate < today;
          const client =
            dataset.rows[followUp.rowIndex]?.[nameIndex] || `Lead #${followUp.rowIndex + 1}`;
          await notify({
            communityKey: dataset.communityKey,
            dedupeKey: `follow-up:${dataset._id}:${followUp.rowIndex}:${followUp.followUpDate}:${recipientId}`,
            recipientRole: user.role === 'admin' ? 'admin' : 'employee',
            recipientUser: recipientId,
            actorName: 'BrainADZ CRM',
            actorRole: 'system',
            type: 'follow_up_reminder',
            title: overdue ? 'Follow-up overdue' : 'Follow-up due today',
            message: `${client} in ${dataset.name} — follow-up due ${followUp.followUpDate}.`,
            link: `/dashboard/clients/${dataset._id}?status=Follow%20Up&followUpDate=${followUp.followUpDate}`,
            meta: {
              datasetId: dataset._id,
              rowIndex: followUp.rowIndex,
              followUpDate: followUp.followUpDate,
            },
          });
        } catch (error) {
          console.error('[follow-up-reminders] Reminder failed:', error.message);
        }
      }
    }
  }
};

const processFollowUpReminders = (options) => {
  if (!activeRun)
    activeRun = runFollowUpReminders(options).finally(() => {
      activeRun = null;
    });
  return activeRun;
};
const queueFollowUpReminderProcessing = () => {
  void processFollowUpReminders().catch((error) =>
    console.error('[follow-up-reminders] Processor failed:', error.message),
  );
};
const startFollowUpReminderScheduler = () => {
  if (scheduler) return;
  queueFollowUpReminderProcessing();
  scheduler = setInterval(queueFollowUpReminderProcessing, 60000);
  scheduler.unref?.();
};

module.exports = {
  runFollowUpReminders,
  processFollowUpReminders,
  queueFollowUpReminderProcessing,
  startFollowUpReminderScheduler,
};
