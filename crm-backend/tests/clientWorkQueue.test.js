const test = require('node:test');
const assert = require('node:assert/strict');
const { getRowActivity, prepareWorkQueue } = require('../utils/clientWorkQueue');
const now = new Date('2026-09-22T06:00:00Z');
const makeSheet = () => ({
  columns: ['Client Name', 'Status', 'Remark', 'Source'],
  rows: Array.from({ length: 400 }, (_, index) => [
    `Client ${index}`,
    index < 55 ? 'Contacted' : '',
    '',
    index === 399 ? 'Manual Call' : 'Import',
  ]),
  rowLogs: Array.from({ length: 55 }, (_, index) => ({
    rowIndex: index,
    entries: [
      {
        changedAt: `2026-09-21T10:${String(index).padStart(2, '0')}:00Z`,
        changedByName: 'Sales',
        callLogged: true,
      },
    ],
  })),
  rowAssignments: Array.from({ length: 400 }, (_, rowIndex) => ({ rowIndex, employee: 'sales' })),
  followUpDates: {},
});
test('400 leads: resume with 345 untouched, yesterday has all 55 calls, latest first', () => {
  const sheet = makeSheet();
  const result = prepareWorkQueue(sheet, {}, 'sales', now);
  assert.equal(result.workCounts.untouched, 345);
  assert.equal(result.workCounts.yesterday, 55);
  assert.equal(result.rows.length, 50);
  assert.equal(result.originalRowIndexes[0], 54);
  assert.equal(
    prepareWorkQueue(sheet, { workView: 'untouched' }, 'sales', now).originalRowIndexes[0],
    55,
  );
  const yesterday = prepareWorkQueue(sheet, { workView: 'yesterday', page: 2 }, 'sales', now);
  assert.equal(yesterday.rows.length, 5);
  assert.deepEqual(yesterday.originalRowIndexes, [4, 3, 2, 1, 0]);
});
test('source and date filters run before paging and empty results clamp the page', () => {
  const sheet = makeSheet();
  assert.deepEqual(
    prepareWorkQueue(sheet, { source: 'Manual Call', page: 8 }, 'sales', now).originalRowIndexes,
    [399],
  );
  const ranged = prepareWorkQueue(
    sheet,
    { dateFrom: '2026-09-21', dateTo: '2026-09-21' },
    'sales',
    now,
  );
  assert.equal(ranged.pagination.totalRows, 55);
  const empty = prepareWorkQueue(sheet, { dateFrom: '2026-09-22', page: 8 }, 'sales', now);
  assert.equal(empty.pagination.page, 1);
  assert.equal(empty.pagination.totalRows, 0);
});
test('follow-ups include overdue, sort latest first, support oldest first and exact past date', () => {
  const sheet = makeSheet();
  for (const [index, date] of [
    [3, '2026-09-20'],
    [250, '2026-09-22'],
    [399, '2026-09-25'],
  ]) {
    sheet.rows[index][1] = 'Follow Up';
    sheet.followUpDates[index] = date;
  }
  assert.deepEqual(
    prepareWorkQueue(sheet, { status: 'Follow Up' }, 'sales', now).originalRowIndexes,
    [399, 250, 3],
  );
  assert.deepEqual(
    prepareWorkQueue(sheet, { status: 'Follow Up', sort: 'followUpAsc' }, 'sales', now)
      .originalRowIndexes,
    [3, 250, 399],
  );
  assert.deepEqual(
    prepareWorkQueue(sheet, { workView: 'overdue' }, 'sales', now).originalRowIndexes,
    [3],
  );
  assert.deepEqual(
    prepareWorkQueue(sheet, { workView: 'dueToday' }, 'sales', now).originalRowIndexes,
    [250],
  );
  assert.deepEqual(
    prepareWorkQueue(sheet, { followUpDate: '2026-09-20' }, 'sales', now).originalRowIndexes,
    [3],
  );
});
test('assigned scope keeps original row identity and excludes inaccessible metadata', () => {
  const sheet = makeSheet();
  const scoped = {
    ...sheet,
    rows: [sheet.rows[399], sheet.rows[12]],
    originalRowIndexes: [399, 12],
    rowLogs: sheet.rowLogs.filter((entry) => entry.rowIndex === 12),
    rowAssignments: [{ rowIndex: 12, employee: { _id: 'sales' } }],
  };
  const result = prepareWorkQueue(scoped, { assignment: 'mine' }, 'sales', now);
  assert.deepEqual(result.originalRowIndexes, [12]);
  assert.equal(result.rows[0][0], 'Client 12');
  assert.deepEqual(Object.keys(result.rowActivity), ['12']);
  assert.equal(result.workCounts.all, 2);
});
test('daily work history survives a subsequent call and respects India midnight', () => {
  const sheet = {
    columns: ['Status', 'Remark'],
    rows: [['Contacted', 'Called']],
    rowLogs: [
      {
        rowIndex: 0,
        entries: [
          { changedAt: '2026-09-21T18:29:00Z', callLogged: true },
          { changedAt: '2026-09-21T18:31:00Z', callLogged: true },
          { changedAt: '2026-09-22T05:00:00Z', remarkChanged: true },
        ],
      },
    ],
  };
  const result = prepareWorkQueue(sheet, {}, 'sales', now);
  assert.equal(result.workCounts.today, 1);
  assert.equal(result.workCounts.yesterday, 1);
  assert.equal(result.rowActivity[0].lastCallAt, '2026-09-21T18:31:00Z');
  assert.equal(result.rowActivity[0].lastActivityAt, '2026-09-22T05:00:00Z');
  assert.equal(
    getRowActivity([{ rowIndex: 0, entries: [{ changedAt: 'invalid' }] }])[0].lastActivityAt,
    null,
  );
});
