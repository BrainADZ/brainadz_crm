const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/User');
const RolePermission = require('../models/RolePermission');
const Community = require('../models/Community');
const OfficeStructure = require('../models/OfficeStructure');
const BusinessProject = require('../models/BusinessProject');
const BusinessProjectTask = require('../models/BusinessProjectTask');
const organization = require('../services/organizationAccessService');
const audit = require('../services/auditService');

const originals = [
  [organization, 'ensureAccessFoundation'], [audit, 'writeAuditLog'],
  [RolePermission, 'deleteOne'], [Community, 'updateOne'], [User, 'updateMany'],
  [User, 'find'], [User, 'findOne'], [User, 'findById'],
  [OfficeStructure, 'countDocuments'], [OfficeStructure, 'updateOne'],
  [OfficeStructure, 'distinct'], [OfficeStructure, 'find'],
  [BusinessProject, 'create'], [BusinessProject, 'findOne'], [BusinessProject, 'find'],
  [BusinessProjectTask, 'create'], [BusinessProjectTask, 'find'],
].map(([model, method]) => [model, method, model[method]]);
after(() => originals.forEach(([model, method, value]) => { model[method] = value; }));

organization.ensureAccessFoundation = async () => {};
audit.writeAuditLog = async () => {};
RolePermission.deleteOne = async () => {};
Community.updateOne = async () => {};
User.updateMany = async () => {};
OfficeStructure.countDocuments = async () => 1;
OfficeStructure.updateOne = async () => {};
OfficeStructure.distinct = async () => [];
OfficeStructure.find = async () => [];

const router = require('../routes/business');
const post = router.stack.find((layer) => layer.route?.path === '/:resource' && layer.route.methods.post).route.stack[0].handle;
const get = router.stack.find((layer) => layer.route?.path === '/:resource' && layer.route.methods.get).route.stack[0].handle;
const ids = {
  admin: '507f1f77bcf86cd799439001',
  member: '507f1f77bcf86cd799439002',
  outsider: '507f1f77bcf86cd799439003',
  project: '507f1f77bcf86cd799439004',
};
const member = { _id: ids.member, name: 'Developer', email: 'dev@example.test' };
const project = { _id: ids.project, name: 'Website', communityKey: 'live', officeModule: 'Development', memberUserIds: [ids.member] };
const admin = { id: ids.admin, role: 'admin', roleKey: 'super_admin', communities: ['live'] };
const employee = { id: ids.member, role: 'employee', roleKey: 'employee', communities: ['live'] };
const permissions = [
  { resource: 'projects', actions: ['view', 'create'], scope: 'all' },
  { resource: 'tasks', actions: ['create'], scope: 'all' },
];
const invoke = async (handler, resource, user, body = {}) => {
  let status = 200;
  let data;
  await handler({
    params: { resource }, user, body, selectedCommunity: null,
    effectivePermissions: permissions,
  }, {
    status(code) { status = code; return this; },
    json(value) { data = value; return this; },
  });
  return { status, data };
};

test('development project requires actual selected employees', async () => {
  User.find = (query) => ({ select: async () => [member].filter((item) => query._id.$in.includes(String(item._id))) });
  BusinessProject.create = async (payload) => ({ ...payload, _id: ids.project, toObject: () => payload });
  const base = { communityKey: 'live', officeModule: 'Development', name: 'Website', client: 'Client' };
  assert.equal((await invoke(post, 'projects', admin, base)).status, 400);
  assert.equal((await invoke(post, 'projects', admin, { ...base, memberUserIds: [ids.outsider] })).status, 400);
  const saved = await invoke(post, 'projects', admin, { ...base, memberUserIds: [ids.member] });
  assert.equal(saved.status, 201);
  assert.deepEqual(saved.data.item.memberUserIds, [ids.member]);
  assert.deepEqual(saved.data.item.assignedTeam, [{ name: member.name, email: member.email }]);
});

test('development task assignee must belong to its project', async () => {
  BusinessProject.findOne = async () => project;
  User.findOne = () => ({ select: async () => member });
  BusinessProjectTask.create = async (payload) => ({ ...payload, toObject: () => payload });
  const base = { communityKey: 'live', officeModule: 'Development', project: ids.project, name: 'Build UI' };
  assert.equal((await invoke(post, 'project-tasks', admin, { ...base, assigneeUser: ids.outsider })).status, 400);
  const saved = await invoke(post, 'project-tasks', admin, { ...base, assigneeUser: ids.member });
  assert.equal(saved.status, 201);
  assert.equal(saved.data.item.assigneeEmail, member.email);
  assert.equal(saved.data.item.projectName, project.name);
});

test('employee project list is restricted to membership', async () => {
  let query;
  User.findById = () => ({ select: async () => ({ _id: ids.member, name: member.name, email: member.email, communities: ['live'] }) });
  BusinessProjectTask.find = () => ({ select: async () => [] });
  BusinessProject.find = (filter) => { query = filter; return { sort: async () => [] }; };
  const result = await invoke(get, 'projects', employee);
  assert.equal(result.status, 200);
  assert.equal(query.communityKey.$in.includes('live'), true);
  assert.equal(query.$or.some((part) => String(part.memberUserIds) === ids.member), true);
});
