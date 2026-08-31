const Meeting = require('../models/Meeting');
const UserAccessAssignment = require('../models/UserAccessAssignment');
const { createNotification } = require('../utils/notifications');
const { isEmailDeliveryConfigured, sendMeetingReminderEmail } = require('./emailService');

const DEFAULT_TIME_ZONE = 'Asia/Kolkata';
const DEFAULT_INTERVAL_MS = 60 * 1000;
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_CONCURRENCY = 5;
const PROCESSING_LOCK_MS = 10 * 60 * 1000;
const EMAIL_RETRY_DELAY_MS = 15 * 60 * 1000;
const MAX_EMAIL_ATTEMPTS = 3;

let activeRun = null;
let schedulerHandle = null;
let warnedInvalidTimeZone = '';

const boundedNumber = (value, fallback, minimum, maximum) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
};

const resolveTimeZone = () => {
  const requested = String(process.env.MEETING_TIMEZONE || DEFAULT_TIME_ZONE).trim();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: requested }).format(new Date());
    return requested;
  } catch {
    if (warnedInvalidTimeZone !== requested) {
      console.warn(
        `[meeting-reminders] Invalid MEETING_TIMEZONE "${requested}"; using ${DEFAULT_TIME_ZONE}`,
      );
      warnedInvalidTimeZone = requested;
    }
    return DEFAULT_TIME_ZONE;
  }
};

const getDateInTimeZone = (date = new Date(), timeZone = resolveTimeZone()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const buildDueQuery = ({ today, now, employeeId, emailEnabled }) => {
  const staleBefore = new Date(now.getTime() - PROCESSING_LOCK_MS);
  const retryBefore = new Date(now.getTime() - EMAIL_RETRY_DELAY_MS);
  const query = {
    status: 'scheduled',
    meetingDate: today,
    $and: [
      {
        $or: [
          { reminderDate: { $ne: today } },
          { reminderNotificationSentAt: null },
          ...(emailEnabled
            ? [
                {
                  $and: [
                    { reminderEmailSentAt: null },
                    {
                      $or: [
                        { reminderEmailAttempts: { $lt: MAX_EMAIL_ATTEMPTS } },
                        { reminderEmailAttempts: { $exists: false } },
                      ],
                    },
                    {
                      $or: [
                        { reminderEmailLastAttemptAt: null },
                        { reminderEmailLastAttemptAt: { $lte: retryBefore } },
                      ],
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      {
        $or: [
          { reminderProcessingAt: null },
          { reminderProcessingAt: { $lte: staleBefore } },
        ],
      },
    ],
  };
  if (employeeId) query.employee = employeeId;
  return query;
};

const shortError = (error) => String(error?.message || error || 'Unknown error').slice(0, 2000);

const isEmailAttemptDue = (meeting, now) =>
  !meeting.reminderEmailLastAttemptAt ||
  meeting.reminderEmailLastAttemptAt.getTime() <= now.getTime() - EMAIL_RETRY_DELAY_MS;

const employeeStillHasMeetingAccess = async (meeting, employee, now) => {
  if (!employee?._id) return false;
  if (employee.role === 'admin') return true;
  if (!meeting.businessUnitId && !meeting.departmentId) return true;

  return Boolean(
    await UserAccessAssignment.exists({
      userId: employee._id,
      status: 'active',
      startDate: { $lte: now },
      $or: [{ endDate: null }, { endDate: { $gte: now } }],
      ...(meeting.businessUnitId ? { businessUnitIds: meeting.businessUnitId } : {}),
      ...(meeting.departmentId ? { departmentId: meeting.departmentId } : {}),
    }),
  );
};

const buildReminderMessage = (meeting) => {
  const contact = meeting.clientName || meeting.companyName;
  const contactText = contact ? ` with ${contact}` : '';
  const location = meeting.platformOrLocation ? ` (${meeting.platformOrLocation})` : '';
  return `${meeting.meetingTitle}${contactText} is scheduled today at ${meeting.meetingTime}${location}.`;
};

const processClaimedMeeting = async ({ candidateId, dueQuery, claimedAt, emailEnabled }) => {
  const outcome = {
    claimed: 0,
    notificationsSent: 0,
    emailsSent: 0,
    failures: 0,
  };
  let meeting = null;

  try {
    meeting = await Meeting.findOneAndUpdate(
      { ...dueQuery, _id: candidateId },
      { $set: { reminderProcessingAt: claimedAt } },
      { new: true },
    )
      .select(
        '+reminderDate +reminderNotificationSentAt +reminderEmailSentAt +reminderEmailAttempts +reminderEmailLastAttemptAt +reminderEmailLastError +reminderProcessingAt',
      )
      .populate({
        path: 'employee',
        select: 'name email employeeId role accountStatus isDeleted',
        match: { accountStatus: 'active', isDeleted: { $ne: true } },
      });

    if (!meeting) return outcome;
    outcome.claimed = 1;

    if (meeting.reminderDate !== meeting.meetingDate) {
      await Meeting.updateOne(
        { _id: meeting._id, reminderProcessingAt: claimedAt },
        {
          $set: {
            reminderDate: meeting.meetingDate,
            reminderNotificationSentAt: null,
            reminderEmailSentAt: null,
            reminderEmailAttempts: 0,
            reminderEmailLastAttemptAt: null,
            reminderEmailLastError: '',
          },
        },
      );
      meeting.reminderDate = meeting.meetingDate;
      meeting.reminderNotificationSentAt = null;
      meeting.reminderEmailSentAt = null;
      meeting.reminderEmailAttempts = 0;
      meeting.reminderEmailLastAttemptAt = null;
      meeting.reminderEmailLastError = '';
    }

    const employee = meeting.employee;
    const employeeId = employee?._id;
    if (!employeeId || !(await employeeStillHasMeetingAccess(meeting, employee, claimedAt))) {
      await Meeting.updateOne(
        { _id: meeting._id, reminderProcessingAt: claimedAt },
        {
          $set: {
            reminderDate: meeting.meetingDate,
            reminderNotificationSentAt: claimedAt,
            reminderEmailSentAt: claimedAt,
            reminderEmailLastError:
              'Reminder suppressed because the assigned employee is inactive or no longer has meeting access',
          },
        },
      );
      return outcome;
    }

    if (!meeting.reminderNotificationSentAt) {
      try {
        if (!employeeId) throw new Error('The meeting has no assigned employee');
        const notification = await createNotification({
          communityKey: meeting.communityKey,
          dedupeKey: `meeting-reminder:${meeting._id}:${meeting.meetingDate}:${employeeId}`,
          recipientRole: employee.role === 'admin' ? 'admin' : 'employee',
          recipientUser: employeeId,
          actorName: 'BrainADZ CRM',
          actorRole: 'system',
          type: 'meeting_reminder',
          title: `Meeting today at ${meeting.meetingTime}`,
          message: buildReminderMessage(meeting),
          link: `/dashboard/meetings?meetingId=${encodeURIComponent(String(meeting._id))}`,
          meta: {
            meetingId: meeting._id,
            datasetId: meeting.dataset || null,
            rowIndex: meeting.rowIndex,
            meetingDate: meeting.meetingDate,
            meetingTime: meeting.meetingTime,
          },
        });
        if (!notification) throw new Error('The bell notification could not be created');

        const notificationUpdate = await Meeting.updateOne(
          { _id: meeting._id, reminderNotificationSentAt: null },
          { $set: { reminderNotificationSentAt: new Date() } },
        );
        if (notificationUpdate.modifiedCount) outcome.notificationsSent += 1;
      } catch (error) {
        outcome.failures += 1;
        console.error(
          `[meeting-reminders] Bell reminder failed for meeting ${meeting._id}:`,
          shortError(error),
        );
      }
    }

    if (
      emailEnabled &&
      !meeting.reminderEmailSentAt &&
      (Number(meeting.reminderEmailAttempts) || 0) < MAX_EMAIL_ATTEMPTS &&
      isEmailAttemptDue(meeting, claimedAt)
    ) {
      const attemptedAt = new Date();
      try {
        const attemptUpdate = await Meeting.updateOne(
          { _id: meeting._id, reminderEmailSentAt: null },
          {
            $inc: { reminderEmailAttempts: 1 },
            $set: {
              reminderEmailLastAttemptAt: attemptedAt,
              reminderEmailLastError: '',
            },
          },
        );

        if (attemptUpdate.modifiedCount) {
          await sendMeetingReminderEmail({ meeting, employee });
          const emailUpdate = await Meeting.updateOne(
            { _id: meeting._id, reminderEmailSentAt: null },
            {
              $set: {
                reminderEmailSentAt: new Date(),
                reminderEmailLastError: '',
              },
            },
          );
          if (emailUpdate.modifiedCount) outcome.emailsSent += 1;
        }
      } catch (error) {
        outcome.failures += 1;
        const message = shortError(error);
        try {
          await Meeting.updateOne(
            { _id: meeting._id, reminderEmailSentAt: null },
            {
              $set: {
                reminderEmailLastAttemptAt: attemptedAt,
                reminderEmailLastError: message,
              },
            },
          );
        } catch (updateError) {
          console.error(
            `[meeting-reminders] Could not record email failure for meeting ${meeting._id}:`,
            shortError(updateError),
          );
        }
        console.error(
          `[meeting-reminders] Email reminder failed for meeting ${meeting._id}:`,
          message,
        );
      }
    }
  } catch (error) {
    outcome.failures += 1;
    console.error(
      `[meeting-reminders] Processing failed for meeting ${candidateId}:`,
      shortError(error),
    );
  } finally {
    if (meeting) {
      try {
        await Meeting.updateOne(
          { _id: meeting._id, reminderProcessingAt: claimedAt },
          { $set: { reminderProcessingAt: null } },
        );
      } catch (error) {
        console.error(
          `[meeting-reminders] Could not release meeting ${meeting._id}:`,
          shortError(error),
        );
      }
    }
  }

  return outcome;
};

const runMeetingReminderProcessor = async (options = {}) => {
  const now = options.now instanceof Date ? options.now : new Date();
  const today = getDateInTimeZone(now);
  const batchSize = boundedNumber(
    options.batchSize || process.env.MEETING_REMINDER_BATCH_SIZE,
    DEFAULT_BATCH_SIZE,
    1,
    250,
  );
  const concurrency = boundedNumber(
    options.concurrency || process.env.MEETING_REMINDER_CONCURRENCY,
    DEFAULT_CONCURRENCY,
    1,
    20,
  );
  const emailEnabled = isEmailDeliveryConfigured();
  const dueQuery = buildDueQuery({
    today,
    now,
    employeeId: options.employeeId,
    emailEnabled,
  });
  const candidates = await Meeting.find(dueQuery)
    .select('_id')
    .sort({ meetingTime: 1, _id: 1 })
    .limit(batchSize)
    .lean();

  const totals = {
    date: today,
    claimed: 0,
    notificationsSent: 0,
    emailsSent: 0,
    failures: 0,
  };

  const outcomes = new Array(candidates.length);
  let nextCandidate = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, candidates.length) },
    async () => {
      while (nextCandidate < candidates.length) {
        const index = nextCandidate;
        nextCandidate += 1;
        outcomes[index] = await processClaimedMeeting({
          candidateId: candidates[index]._id,
          dueQuery,
          claimedAt: now,
          emailEnabled,
        });
      }
    },
  );
  await Promise.all(workers);

  outcomes.forEach((outcome) => {
    totals.claimed += outcome.claimed;
    totals.notificationsSent += outcome.notificationsSent;
    totals.emailsSent += outcome.emailsSent;
    totals.failures += outcome.failures;
  });
  return totals;
};

const processMeetingReminders = (options = {}) => {
  if (activeRun) return activeRun;
  activeRun = runMeetingReminderProcessor(options).finally(() => {
    activeRun = null;
  });
  return activeRun;
};

const queueMeetingReminderProcessing = (options = {}) => {
  void processMeetingReminders(options).catch((error) => {
    console.error('[meeting-reminders] Processor failed:', shortError(error));
  });
};

const startMeetingReminderScheduler = () => {
  if (schedulerHandle) return schedulerHandle;
  const intervalMs = boundedNumber(
    process.env.MEETING_REMINDER_INTERVAL_MS,
    DEFAULT_INTERVAL_MS,
    30 * 1000,
    5 * 60 * 1000,
  );

  queueMeetingReminderProcessing();
  schedulerHandle = setInterval(queueMeetingReminderProcessing, intervalMs);
  schedulerHandle.unref?.();
  console.log(
    `[meeting-reminders] Scheduler started (${resolveTimeZone()}, every ${Math.round(intervalMs / 1000)}s)`,
  );
  return schedulerHandle;
};

const stopMeetingReminderScheduler = () => {
  if (!schedulerHandle) return;
  clearInterval(schedulerHandle);
  schedulerHandle = null;
};

module.exports = {
  getDateInTimeZone,
  processMeetingReminders,
  queueMeetingReminderProcessing,
  startMeetingReminderScheduler,
  stopMeetingReminderScheduler,
};
