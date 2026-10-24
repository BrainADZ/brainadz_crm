const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const router = require('../routes/business');
const User = require('../models/User');
const BusinessProject = require('../models/BusinessProject');
const BusinessProjectTask = require('../models/BusinessProjectTask');
const DevelopmentDailyReport = require('../models/DevelopmentDailyReport');

const ids = {
  employee: '507f1f77bcf86cd799439001',
  project: '507f1f77bcf86cd799439002',
  otherProject: '507f1f77bcf86cd799439003',
  task: '507f1f77bcf86cd799439004',
  otherTask: '507f1f77bcf86cd799439005',
};
const original = {
  user: User.findById, projects: BusinessProject.find, tasks: BusinessProjectTask.find,
  reports: DevelopmentDailyReport.find, findOne: DevelopmentDailyReport.findOne,
  create: DevelopmentDailyReport.create, update: DevelopmentDailyReport.findOneAndUpdate,
};
after(() => {
  User.findById = original.user;
  BusinessProject.find = original.projects;
  BusinessProjectTask.find = original.tasks;
  DevelopmentDailyReport.find = original.reports;
  DevelopmentDailyReport.findOne = original.findOne;
  DevelopmentDailyReport.create = original.create;
  DevelopmentDailyReport.findOneAndUpdate = original.update;
});

const route = (path, method) => router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route.stack[0].handle;
const permissions = [{ resource: 'daily_reports', actions: ['view', 'create', 'update'], scope: 'all' }];
const invoke = async (handler, user, body = {}, grants = permissions) => {
  let status = 200;
  let data;
  await handler({ user, body, params: { date: '2020-01-01' }, selectedCommunity: null, effectivePermissions: grants }, {
    status(code) { status = code; return this; }, json(value) { data = value; return this; },
  });
  return { status, data };
};
const admin = { id: ids.employee, role: 'admin', roleKey: 'super_admin', communities: ['live'] };
const employee = { id: ids.employee, role: 'employee', roleKey: 'developer', communities: ['live'], primaryCommunity: 'live' };
const entry = (project = ids.project, task = ids.task, hoursSpent = 3) => ({
  project, task, workType: 'Development', workSummary: 'Implemented UI', hoursSpent,
});
const report = (entries = [entry()]) => ({ communityKey: 'live', entries, status: 'submitted', additionalNotes: 'Ready for review' });
const mockAssignments = () => {
  BusinessProjectTask.find = () => ({ select: async () => [
    { _id: ids.task, project: ids.project, name: 'Build UI', status: 'In Progress' },
  ] });
  BusinessProject.find = () => ({ select: async () => [
    { _id: ids.project, name: 'Website', communityKey: 'live' },
  ] });
  User.findById = () => ({ select: async () => ({ _id: ids.employee, name: 'Developer', email: 'dev@example.test' }) });
};

test('admin sees employee reports and cannot submit', async () => {
  DevelopmentDailyReport.find = () => {
    const chain = { populate: () => chain, sort: async () => [
      { user: { role: 'employee' } }, { user: { role: 'admin' } },
    ] }; return chain;
  };
  const result = await invoke(route('/development/daily-reports', 'get'), admin);
  assert.equal(result.status, 200);
  assert.equal(result.data.length, 1);
  assert.equal((await invoke(route('/development/daily-reports/:date', 'put'), admin, report())).status, 403);
});

test('employee sees only their own reports', async () => {
  let query;
  DevelopmentDailyReport.find = (filter) => {
    query = filter; const chain = { populate: () => chain, sort: async () => [] }; return chain;
  };
  assert.equal((await invoke(route('/development/daily-reports', 'get'), employee)).status, 200);
  assert.equal(query.user, ids.employee);
});

test('multiple entries save as one submitted day and cannot be changed', async () => {
  mockAssignments();
  DevelopmentDailyReport.findOne = async () => null;
  let created;
  DevelopmentDailyReport.create = async (payload) => { created = payload; return { _id: 'report-1', ...payload }; };
  const saved = await invoke(route('/development/daily-reports/:date', 'put'), employee, report([entry(), entry(ids.project, '', 2)]));
  assert.equal(saved.status, 200);
  assert.equal(created.entries.length, 2);
  assert.equal(created.hoursWorked, 5);
  assert.equal(created.entries[0].taskName, 'Build UI');
  assert.equal(created.status, 'submitted');
  DevelopmentDailyReport.findOne = async () => created;
  assert.equal((await invoke(route('/development/daily-reports/:date', 'put'), employee, report())).status, 409);
});

test('draft can be updated, then submitted and locked', async () => {
  mockAssignments();
  DevelopmentDailyReport.findOne = async () => ({ status: 'draft' });
  let updateQuery;
  DevelopmentDailyReport.findOneAndUpdate = async (query, update) => {
    updateQuery = query; return update.$set;
  };
  const result = await invoke(route('/development/daily-reports/:date', 'put'), employee, { ...report(), status: 'draft' });
  assert.equal(result.status, 200);
  assert.equal(result.data.item.status, 'draft');
  assert.equal(updateQuery.status, 'draft');
  const submitted = await invoke(route('/development/daily-reports/:date', 'put'), employee, report());
  assert.equal(submitted.data.item.status, 'submitted');
});

test('rejects unassigned projects and tasks, and more than 24 total hours', async () => {
  mockAssignments();
  DevelopmentDailyReport.findOne = async () => null;
  assert.equal((await invoke(route('/development/daily-reports/:date', 'put'), employee, report([entry(ids.otherProject)]))).status, 403);
  assert.equal((await invoke(route('/development/daily-reports/:date', 'put'), employee, report([entry(ids.project, ids.otherTask)]))).status, 400);
  assert.equal((await invoke(route('/development/daily-reports/:date', 'put'), employee, report([entry(ids.project, '', 14), entry(ids.project, '', 12)]))).status, 400);
});

test('reporting-only employee may submit general work', async () => {
  BusinessProjectTask.find = () => ({ select: async () => [] });
  BusinessProject.find = () => ({ select: async () => [] });
  User.findById = () => ({ select: async () => ({ _id: ids.employee, name: 'Developer', email: 'dev@example.test' }) });
  DevelopmentDailyReport.findOne = async () => null;
  DevelopmentDailyReport.create = async (payload) => payload;
  const result = await invoke(route('/development/daily-reports/:date', 'put'), employee, report([entry('', '', 6)]));
  assert.equal(result.status, 200);
  assert.equal(result.data.item.entries[0].project, null);
});

test('attachments cannot be added after submission', async () => {
  DevelopmentDailyReport.findOne = async () => ({ status: 'submitted', attachments: [] });
  const uploadRoute = router.stack.find((layer) => layer.route?.path === '/development/daily-reports/:date/attachments' && layer.route.methods.post);
  const handler = uploadRoute.route.stack.at(-1).handle;
  let status = 200;
  let data;
  await handler({
    user: employee, body: { communityKey: 'live' }, params: { date: '2020-01-01' },
    effectivePermissions: permissions, files: [{ mimetype: 'image/png', buffer: Buffer.alloc(8) }],
  }, { status(code) { status = code; return this; }, json(value) { data = value; return this; } });
  assert.equal(status, 409);
  assert.match(data.message, /draft/);
});
