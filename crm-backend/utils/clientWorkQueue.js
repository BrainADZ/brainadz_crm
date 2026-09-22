const { getDateInTimeZone } = require('../services/meetingReminderService');

const text = (value) => String(value ?? '').trim();
const id = (value) => String(value?._id || value || '');
const columnIndex = (columns, name) =>
  columns.findIndex((column) => text(column).toLowerCase() === name.toLowerCase());

const getRowActivity = (rowLogs = []) =>
  Object.fromEntries(
    rowLogs.map((log) => {
      const entries = [...(log.entries || [])].filter(
        (entry) => entry.changedAt && !Number.isNaN(new Date(entry.changedAt).getTime()),
      );
      entries.sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));
      const latest = entries[0];
      const call = entries.find((entry) => entry.callLogged);
      return [
        log.rowIndex,
        {
          lastActivityAt: latest?.changedAt || null,
          lastActivityBy: latest?.changedByName || '',
          lastCallAt: call?.changedAt || null,
          activityDates: [
            ...new Set(entries.map((entry) => getDateInTimeZone(new Date(entry.changedAt)))),
          ],
        },
      ];
    }),
  );

// Apply filters to the authorized rows before paging. Row identities never depend on sort order.
const prepareWorkQueue = (response, query = {}, currentUserId, now = new Date()) => {
  const today = getDateInTimeZone(now);
  const yesterday = getDateInTimeZone(new Date(now.getTime() - 86400000));
  const columns = response.columns || [];
  const statusIndex = columnIndex(columns, 'Status');
  const sourceIndex = columnIndex(columns, 'Source');
  const activity = response.rowActivity || getRowActivity(response.rowLogs);
  const assignments = new Map();
  for (const item of response.rowAssignments || []) {
    assignments.set(Number(item.rowIndex), [
      ...(assignments.get(Number(item.rowIndex)) || []),
      item,
    ]);
  }
  const items = response.rows.map((row, index) => {
    const rowIndex = response.originalRowIndexes?.[index] ?? index;
    const last = activity[rowIndex]?.lastActivityAt;
    const lastDate = last ? getDateInTimeZone(new Date(last)) : '';
    const followUpDate =
      text(row[statusIndex]) === 'Follow Up' ? response.followUpDates?.[rowIndex] || '' : '';
    return {
      row,
      rowIndex,
      last,
      lastDate,
      activityDates: activity[rowIndex]?.activityDates || [],
      followUpDate,
      assignments: assignments.get(rowIndex) || [],
    };
  });
  const workMatches = (item, view) => {
    if (view === 'untouched')
      return (
        !item.last &&
        ['', 'Pending'].includes(text(item.row[statusIndex])) &&
        !text(item.row[columnIndex(columns, 'Remark')])
      );
    if (view === 'today') return item.activityDates.includes(today);
    if (view === 'yesterday') return item.activityDates.includes(yesterday);
    if (view === 'due') return Boolean(item.followUpDate && item.followUpDate <= today);
    if (view === 'dueToday') return item.followUpDate === today;
    if (view === 'overdue') return Boolean(item.followUpDate && item.followUpDate < today);
    if (view === 'upcoming') return item.followUpDate > today;
    return true;
  };
  const workCounts = Object.fromEntries(
    ['all', 'untouched', 'today', 'yesterday', 'due', 'dueToday', 'overdue', 'upcoming'].map(
      (view) => [view, items.filter((item) => workMatches(item, view)).length],
    ),
  );
  const statusCounts = { all: items.length };
  for (const item of items) {
    const status = text(item.row[statusIndex]);
    if (status) statusCounts[status] = (statusCounts[status] || 0) + 1;
  }
  const search = text(query.search).toLowerCase();
  const filtered = items.filter((item) => {
    const { row, assignments: assigned } = item;
    const hasEmployee = (employeeId) =>
      assigned.some((entry) => id(entry.employee) === id(employeeId));
    const date = query.dateField === 'followUp' ? item.followUpDate : item.lastDate;
    return (
      (!search || row.some((cell) => text(cell).toLowerCase().includes(search))) &&
      (!query.status || query.status === 'all' || text(row[statusIndex]) === query.status) &&
      (!query.employeeId || query.employeeId === 'all' || hasEmployee(query.employeeId)) &&
      (!query.assignment ||
        query.assignment === 'all' ||
        (query.assignment === 'assigned' && assigned.length > 0) ||
        (query.assignment === 'unassigned' && !assigned.length) ||
        (query.assignment === 'mine' && hasEmployee(currentUserId))) &&
      (!query.source || query.source === 'all' || text(row[sourceIndex]) === query.source) &&
      (!query.followUpDate || item.followUpDate === query.followUpDate) &&
      (!query.dateFrom || (date && date >= query.dateFrom)) &&
      (!query.dateTo || (date && date <= query.dateTo)) &&
      workMatches(item, query.workView)
    );
  });
  const sort =
    query.sort && query.sort !== 'auto'
      ? query.sort
      : query.status === 'Follow Up' ||
          ['due', 'dueToday', 'overdue', 'upcoming'].includes(query.workView)
        ? 'followUpDesc'
        : 'activityDesc';
  filtered.sort((a, b) => {
    if (sort === 'original') return a.rowIndex - b.rowIndex;
    const followUp = sort.startsWith('followUp');
    const first = followUp ? a.followUpDate : a.last ? new Date(a.last).toISOString() : '';
    const second = followUp ? b.followUpDate : b.last ? new Date(b.last).toISOString() : '';
    if (!first || !second) return (first ? -1 : second ? 1 : 0) || a.rowIndex - b.rowIndex;
    const order = sort.endsWith('Asc') ? first.localeCompare(second) : second.localeCompare(first);
    return order || a.rowIndex - b.rowIndex;
  });
  const pageSize = Math.min(100, Math.max(10, Number.parseInt(query.pageSize, 10) || 50));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(totalPages, Math.max(1, Number.parseInt(query.page, 10) || 1));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  const indexes = new Set(pageItems.map((item) => item.rowIndex));
  return {
    ...response,
    rows: pageItems.map((item) => item.row),
    originalRowIndexes: [...indexes],
    rowLogs: response.rowLogs?.filter((item) => indexes.has(Number(item.rowIndex))),
    rowAssignments: response.rowAssignments?.filter((item) => indexes.has(Number(item.rowIndex))),
    rowAssignmentHistory: response.rowAssignmentHistory?.filter((item) =>
      indexes.has(Number(item.rowIndex)),
    ),
    rowFollowUps: undefined,
    followUpDates: Object.fromEntries(
      Object.entries(response.followUpDates || {}).filter(([index]) => indexes.has(Number(index))),
    ),
    rowMeetings: Object.fromEntries(
      Object.entries(response.rowMeetings || {}).filter(([index]) => indexes.has(Number(index))),
    ),
    rowActivity: Object.fromEntries([...indexes].map((index) => [index, activity[index] || {}])),
    sourceOptions: [
      ...new Set(items.map((item) => text(item.row[sourceIndex])).filter(Boolean)),
    ].sort(),
    statusCounts,
    workCounts,
    today,
    pagination: { page, pageSize, totalRows: filtered.length, totalPages },
  };
};

module.exports = { getRowActivity, prepareWorkQueue };
