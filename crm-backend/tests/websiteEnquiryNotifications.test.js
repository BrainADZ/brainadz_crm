const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const sift = require('sift').default;

const load = (relative, stubs, extra = '') => {
  const filename = path.resolve(__dirname, relative);
  const realRequire = createRequire(filename);
  const context = {
    require: (name) => (Object.hasOwn(stubs, name) ? stubs[name] : realRequire(name)),
    module: { exports: {} },
    console: { error() {}, warn() {} },
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8') + extra, context, { filename });
  return context.module.exports;
};
const chain = (value) => ({
  select() {
    return this;
  },
  populate() {
    return this;
  },
  lean() {
    return Promise.resolve(value);
  },
  then(resolve, reject) {
    return Promise.resolve(value).then(resolve, reject);
  },
});
const enquiryId = '507f1f77bcf86cd799439011';
const actorId = '507f1f77bcf86cd799439012';
const Enquiry = require('../models/WebsiteEnquiry');
const access = require('../services/accessControlService');

const fixture = () =>
  new Enquiry({
    _id: enquiryId,
    enquiryNumber: 'MKT-00001',
    communityKey: 'marketing',
    name: 'Sample Client',
    email: 'client@example.test',
    phone: '9999999999',
    activity: [{ type: 'created', message: 'Enquiry received', changedByName: 'Website' }],
  });

test('enquiry recipients require view permission, community and record scope; retry keys are stable', async () => {
  const users = [
    { _id: 'admin', role: 'admin', scope: 'all' },
    { _id: 'manager', scope: 'community' },
    { _id: 'assigned', scope: 'assigned' },
    { _id: 'unassigned', scope: 'assigned' },
    { _id: 'denied', scope: 'community', denied: true },
    { _id: 'other-unit', scope: 'all', communities: ['live'] },
  ].map((user) => ({
    role: 'employee',
    roleKey: 'employee',
    officeModule: 'Sales',
    communities: ['marketing'],
    ...user,
  }));
  const stored = new Map();
  const queries = [];
  const service = load('../services/websiteEnquiryNotificationService.js', {
    '../models/User': {
      find: (filter) => {
        assert.equal(filter.accountStatus, 'active');
        assert.equal(filter.isDeleted.$ne, true);
        return chain(users);
      },
    },
    '../models/WebsiteEnquiry': {
      exists: async (filter) => {
        queries.push(filter);
        assert.equal(String(filter.$and[0]._id), enquiryId);
        const scope = filter.$and[1];
        return sift(scope)(enquiry);
      },
    },
    './accessControlService': {
      ...access,
      resolveEffectivePermissions: async (user) => [
        {
          resource: 'website_enquiries',
          actions: ['view'],
          deniedActions: user.denied ? ['view'] : [],
          scope: user.scope,
        },
      ],
    },
    '../utils/notifications': {
      createNotification: async (payload) => stored.set(payload.dedupeKey, payload),
    },
  });
  const enquiry = fixture();
  await service.notifyWebsiteEnquiry({ enquiry });
  await service.notifyWebsiteEnquiry({ enquiry });
  assert.deepEqual(
    [...stored.values()].map((n) => n.recipientUser),
    ['admin', 'manager', 'assigned', 'unassigned'],
  );
  assert.equal(queries.length, 8);
  assert.ok([...stored.values()].every((n) => n.link === '/dashboard/website-enquiries/marketing'));
});

const controllerSetup = ({ canView = true } = {}) => {
  let enquiry = fixture();
  let saves = 0;
  let atomicSaves = 0;
  let saveError = null;
  let modified = 1;
  const notices = [];
  enquiry.save = async () => {
    saves += 1;
  };
  const controller = load('../controllers/websiteEnquiryController.js', {
    '../models/Counter': { findOneAndUpdate: async () => ({ value: 1 }) },
    '../models/User': { findOne: () => chain({ _id: actorId, name: 'Ayushi' }) },
    '../services/accessControlService': {
      ...access,
      resolveEffectivePermissions: async () =>
        canView ? [{ resource: 'website_enquiries', actions: ['view'], scope: 'ASSIGNED' }] : [],
    },
    '../models/WebsiteEnquiry': {
      create: async (payload) => {
        enquiry = new Enquiry(payload);
        return enquiry;
      },
      findOne: async () => enquiry,
      findOneAndUpdate: async (filter, update) => {
        if (saveError) throw saveError;
        const expected = filter.$and[2];
        if (
          String(enquiry.assignedTo || '') !== String(expected.assignedTo || '') ||
          enquiry.status !== expected.status
        )
          return null;
        atomicSaves += 1;
        Object.assign(enquiry, update.$set);
        enquiry.activity.push(update.$push.activity);
        return enquiry;
      },
      findById: () => chain(enquiry),
      find: (filter) => chain(filter.$and && modified === 0 ? [] : [enquiry]),
      updateMany: async (filter, update) => {
        if (modified) {
          Object.assign(enquiry, update.$set);
          enquiry.activity.push(update.$push.activity);
        }
        return { modifiedCount: modified };
      },
    },
    '../services/emailService': { isEmailDeliveryConfigured: () => false },
    '../services/websiteEnquiryNotificationService': {
      notifyWebsiteEnquiry: async (payload) => {
        notices.push({ type: payload.enquiry.activity.at(-1).type, actor: payload.actor });
      },
    },
  });
  const req = {
    params: { id: enquiryId },
    body: {},
    user: {
      _id: actorId,
      role: 'admin',
      roleKey: 'super_admin',
      name: 'Ayushi',
    },
  };
  const res = {
    status() {
      return this;
    },
    json(value) {
      this.value = value;
    },
  };
  const next = (error) => {
    throw error;
  };
  return {
    controller,
    req,
    res,
    next,
    notices,
    enquiry,
    saves: () => saves,
    atomicSaves: () => atomicSaves,
    failSave: (message) => {
      saveError = new Error(message);
    },
    setModified: (value) => {
      modified = value;
    },
  };
};

test('assignment rejects employees without enquiry view access before writing', async () => {
  const ctx = controllerSetup({ canView: false });
  ctx.req.body = { ids: [enquiryId], employeeId: actorId };
  await assert.rejects(
    ctx.controller.assignEnquiries(ctx.req, ctx.res, ctx.next),
    (error) => error.status === 400 && /Website Enquiry view access/.test(error.message),
  );
  assert.equal(ctx.enquiry.assignedTo, null);
  assert.equal(ctx.enquiry.activity.length, 1);
  assert.equal(ctx.notices.length, 0);
});

for (const method of ['createPublicEnquiry', 'createEnquiry']) {
  test(`${method} creates an in-app notification even when SMTP is unavailable`, async () => {
    const ctx = controllerSetup();
    ctx.req.body = { name: 'Sample Client', email: 'client@example.test', phone: '9999999999' };
    await ctx.controller[method](ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.notices.length, 1);
    assert.equal(ctx.notices[0].type, 'created');
  });
}

test('status/remark and follow-up changes notify after save; unchanged saves do not notify', async () => {
  const ctx = controllerSetup();
  ctx.enquiry.communityKey = 'live';
  ctx.req.body = { communityKey: 'live', status: 'Contacted', remark: 'Meeting details shared' };
  await ctx.controller.updateAction(ctx.req, ctx.res, ctx.next);
  assert.equal(ctx.atomicSaves(), 1);
  assert.equal(ctx.notices[0].type, 'status');
  assert.equal(ctx.notices[0].actor.name, 'Ayushi');
  await ctx.controller.updateAction(ctx.req, ctx.res, ctx.next);
  assert.equal(ctx.notices.length, 1);
  ctx.req.body.remark = 'Confirmed';
  await ctx.controller.updateAction(ctx.req, ctx.res, ctx.next);
  assert.equal(ctx.notices.at(-1).type, 'remark');
  ctx.req.body = {
    communityKey: 'live',
    status: 'Follow Up',
    followUpDate: '2026-10-09',
    remark: 'Confirmed',
  };
  await ctx.controller.updateAction(ctx.req, ctx.res, ctx.next);
  ctx.req.body.followUpDate = '2026-10-10';
  await ctx.controller.updateAction(ctx.req, ctx.res, ctx.next);
  assert.equal(ctx.notices.at(-1).type, 'follow_up');
  assert.equal(ctx.enquiry.validateSync(), undefined);
});

test('failed saves do not emit notifications', async () => {
  const ctx = controllerSetup();
  ctx.enquiry.communityKey = 'live';
  ctx.failSave('Database unavailable');
  ctx.req.body = { communityKey: 'live', status: 'Contacted' };
  await assert.rejects(
    ctx.controller.updateAction(ctx.req, ctx.res, ctx.next),
    /Database unavailable/,
  );
  assert.equal(ctx.notices.length, 0);
});

test('first Marketing status update atomically claims the enquiry', async () => {
  const ctx = controllerSetup();
  ctx.req.body = { communityKey: 'marketing', status: 'Contacted', remark: 'Called client' };
  await ctx.controller.updateAction(ctx.req, ctx.res, ctx.next);
  assert.equal(String(ctx.enquiry.assignedTo), actorId);
  assert.equal(ctx.enquiry.status, 'Contacted');
  assert.equal(ctx.notices.at(-1).type, 'status');
  assert.equal(ctx.saves(), 0);
  assert.equal(ctx.enquiry.validateSync(), undefined);
  ctx.req.user = {
    _id: '507f1f77bcf86cd799439099',
    roleKey: 'sales_executive',
    communities: ['marketing'],
    name: 'Other seller',
  };
  ctx.req.body.status = 'Interested';
  await assert.rejects(
    ctx.controller.updateAction(ctx.req, ctx.res, ctx.next),
    (error) => error.status === 409,
  );
  assert.equal(ctx.enquiry.status, 'Contacted');
});

test('assignment and unassignment notify; assigning the same employee again does not', async () => {
  const ctx = controllerSetup();
  ctx.req.body = { ids: [enquiryId], employeeId: actorId };
  await ctx.controller.assignEnquiries(ctx.req, ctx.res, ctx.next);
  assert.equal(ctx.notices[0].type, 'assignment');
  ctx.setModified(0);
  await ctx.controller.assignEnquiries(ctx.req, ctx.res, ctx.next);
  assert.equal(ctx.notices.length, 1);
  ctx.setModified(1);
  ctx.req.body.employeeId = '';
  await ctx.controller.assignEnquiries(ctx.req, ctx.res, ctx.next);
  assert.equal(ctx.notices.length, 2);
});

test('bell keeps personal notifications across role changes without exposing other recipients', () => {
  const router = { get() {}, patch() {}, delete() {} };
  const getFilter = load(
    '../routes/notifications.js',
    {
      express: { Router: () => router },
    },
    '\nmodule.exports = getRecipientFilter;',
  );
  assert.deepEqual(JSON.parse(JSON.stringify(getFilter({ id: 'me', role: 'employee' }))), {
    recipientUser: 'me',
  });
  const filter = getFilter({ id: 'me', role: 'employee', roleKey: 'super_admin' });
  assert.equal(filter.$or[0].recipientRole, 'admin');
  assert.equal(filter.$or[0].recipientUser, null);
  assert.equal(filter.$or[1].recipientUser, 'me');
});
