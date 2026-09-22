const test = require('node:test');
const assert = require('node:assert/strict');
const { runFollowUpReminders } = require('../services/followUpReminderService');

test('due reminders catch up after downtime, target current assignees, and use stable dedupe keys', async () => {
  const dataset = {
    _id: 'sheet',
    name: 'Sales list',
    communityKey: 'marketing',
    uploadedBy: 'owner',
    columns: ['Client Name', 'Status'],
    rows: [
      ['Due client', 'Follow Up'],
      ['Late client', 'Follow Up'],
      ['Future client', 'Follow Up'],
      ['Closed client', 'Converted'],
      ['Owner client', 'Follow Up'],
    ],
    rowFollowUps: [0, 1, 2, 3, 4].map((rowIndex) => ({
      rowIndex,
      followUpDate: ['2026-09-22', '2026-09-20', '2026-09-25', '2026-09-22', '2026-09-22'][
        rowIndex
      ],
    })),
    rowAssignments: [
      { rowIndex: 0, employee: 'sales' },
      { rowIndex: 0, employee: 'sales' },
      { rowIndex: 1, employee: 'sales' },
      { rowIndex: 1, employee: 'inactive' },
      { rowIndex: 1, employee: 'revoked' },
    ],
  };
  const stored = new Map();
  const options = {
    now: new Date('2026-09-22T06:00:00Z'),
    Dataset: {
      find: () => ({
        select: () => ({
          lean: () => ({
            cursor: async function* () {
              yield dataset;
            },
          }),
        }),
      }),
    },
    Users: {
      findOne: ({ _id }) => ({
        lean: async () =>
          _id === 'inactive' ? null : { _id, role: _id === 'owner' ? 'admin' : 'employee' },
      }),
    },
    canReceive: async (user) => user._id !== 'revoked',
    notify: async (payload) => {
      if (!stored.has(payload.dedupeKey)) stored.set(payload.dedupeKey, payload);
    },
  };
  await runFollowUpReminders(options);
  await runFollowUpReminders(options);
  assert.equal(stored.size, 3);
  const reminders = [...stored.values()];
  assert.deepEqual(
    reminders.map((item) => item.meta.rowIndex),
    [0, 1, 4],
  );
  assert.equal(reminders[1].title, 'Follow-up overdue');
  assert.equal(reminders[2].recipientUser, 'owner');
  assert.equal(reminders[2].recipientRole, 'admin');
  assert.match(reminders[0].link, /followUpDate=2026-09-22/);
  dataset.rowAssignments[0].employee = 'new-sales';
  dataset.rowAssignments.splice(1, 1);
  await runFollowUpReminders(options);
  assert.equal(stored.size, 4);
  assert.equal([...stored.values()].at(-1).recipientUser, 'new-sales');
  dataset.rowFollowUps[0].followUpDate = '2026-09-23';
  await runFollowUpReminders(options);
  assert.equal(stored.size, 4);
  options.now = new Date('2026-09-23T06:00:00Z');
  await runFollowUpReminders(options);
  assert.equal(stored.size, 5);
});

test('failed recipient does not prevent other due reminders from being processed', async () => {
  const delivered = [];
  const originalError = console.error;
  console.error = () => {};
  try {
    await runFollowUpReminders({
      now: new Date('2026-09-22T06:00:00Z'),
      Dataset: {
        find: () => ({
          select: () => ({
            lean: () => ({
              cursor: async function* () {
                yield {
                  _id: 'sheet',
                  name: 'Sheet',
                  columns: ['Status'],
                  rows: [['Follow Up']],
                  rowFollowUps: [{ rowIndex: 0, followUpDate: '2026-09-22' }],
                  rowAssignments: [
                    { rowIndex: 0, employee: 'bad' },
                    { rowIndex: 0, employee: 'good' },
                  ],
                };
              },
            }),
          }),
        }),
      },
      Users: { findOne: ({ _id }) => ({ lean: async () => ({ _id }) }) },
      canReceive: async () => true,
      notify: async (payload) => {
        if (payload.recipientUser === 'bad') throw new Error('Temporary failure');
        delivered.push(payload);
      },
    });
  } finally {
    console.error = originalError;
  }
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].recipientUser, 'good');
});
