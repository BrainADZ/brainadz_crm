const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const crypto = require('node:crypto');
const sift = require('sift').default;
const { buildScopeQuery } = require('../services/accessControlService');

const controllerFixture = () => {
  const rows = [];
  const notifications = [];
  const emails = [];
  let counter = 0;
  const chain = (value) => ({
    populate() {
      return this;
    },
    select() {
      return this;
    },
    lean: async () => value,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  });
  const model = {
    findOne: async (filter) => rows.find(sift(filter)) || null,
    findById: (id) => chain(rows.find((row) => row._id === id)),
    create: async (payload) => {
      if (
        payload.websiteRequestId &&
        rows.some(
          (row) =>
            row.websiteRequestId === payload.websiteRequestId &&
            row.communityKey === payload.communityKey,
        )
      ) {
        throw Object.assign(new Error('Duplicate request'), {
          code: 11000,
          keyPattern: { communityKey: 1, websiteRequestId: 1 },
        });
      }
      const row = { _id: '507f1f77bcf86cd799439011', assignedTo: null, ...payload };
      rows.push(row);
      return row;
    },
    findOneAndUpdate: async (filter, update) => {
      const row = rows.find(sift(filter));
      if (!row) return null;
      Object.assign(row, update.$set);
      if (update.$push?.activity) row.activity.push(update.$push.activity);
      return row;
    },
  };
  const filename = path.resolve(__dirname, '../controllers/websiteEnquiryController.js');
  const realRequire = createRequire(filename);
  const stubs = {
    '../models/WebsiteEnquiry': model,
    '../models/Counter': { findOneAndUpdate: async () => ({ value: ++counter }) },
    '../services/websiteEnquiryNotificationService': {
      notifyWebsiteEnquiry: async (event) => notifications.push(event),
    },
    '../services/emailService': {
      isEmailDeliveryConfigured: () => true,
      sendWebsiteEnquiryNotification: async (event) => emails.push(event),
    },
  };
  const context = {
    require: (name) => stubs[name] || realRequire(name),
    module: { exports: {} },
    console: { error() {}, warn() {} },
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  const invoke = async (method, request) => {
    const res = {
      code: 200,
      status(code) {
        this.code = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    await context.module.exports[method](request, res, (error) => {
      res.code = error.status || 500;
      res.body = { message: error.message };
    });
    return res;
  };
  return { rows, notifications, emails, invoke, controller: context.module.exports };
};

const fields = () => ({
  requestId: crypto.randomUUID(),
  submittedAt: new Date(Date.now() - 1000).toISOString(),
  name: 'Live Visitor',
  email: 'visitor@example.test',
  phone: '+91 9876543210',
  company: 'Example',
  serviceCategory: 'Software Services',
  service: 'ERP Development',
  message: 'Need inventory and finance',
  pageUrl: 'https://brainadzlive.com/contact-us',
});

test('Live ingestion fixes the community and preserves the original enquiry fields', async () => {
  const fixture = controllerFixture();
  const body = {
    ...fields(),
    communityKey: 'marketing',
    priority: 'High',
    status: 'Converted',
    assignedTo: 'attacker',
    source: 'Spoofed source',
  };
  const result = await fixture.invoke('createLivePublicEnquiry', { body });
  assert.equal(result.code, 201);
  assert.match(result.body.enquiryNumber, /^LIVE-/);
  const row = fixture.rows[0];
  assert.equal(row.communityKey, 'live');
  assert.equal(row.serviceCategory, body.serviceCategory);
  assert.equal(row.service, body.service);
  assert.equal(row.message, body.message);
  assert.equal(row.pageUrl, body.pageUrl);
  assert.equal(row.createdAt.toISOString(), body.submittedAt);
  assert.equal(row.status, 'Pending');
  assert.equal(row.priority, 'Medium');
  assert.equal(row.assignedTo, null);
  assert.equal(row.source, 'BrainADZ Live website');
  assert.equal(fixture.notifications.length, 1);
  assert.equal(fixture.emails.length, 0);
});

test('delivery retries and simultaneous requests create one Live enquiry', async () => {
  const fixture = controllerFixture();
  const body = fields();
  const results = await Promise.all([
    fixture.invoke('createLivePublicEnquiry', { body }),
    fixture.invoke('createLivePublicEnquiry', { body }),
  ]);
  assert.deepEqual(results.map((result) => result.code).sort(), [200, 201]);
  assert.equal(fixture.rows.length, 1);
  assert.equal(fixture.notifications.length, 1);
  assert.equal((await fixture.invoke('createLivePublicEnquiry', { body })).code, 200);
  assert.equal(
    (
      await fixture.invoke('createLivePublicEnquiry', {
        body: { ...body, message: 'Different request' },
      })
    ).code,
    409,
  );
});

test('invalid submissions cannot create records', async () => {
  const fixture = controllerFixture();
  for (const override of [
    { requestId: 'invalid' },
    { email: 'invalid' },
    { phone: '123' },
    { name: '' },
    { submittedAt: 'invalid' },
  ]) {
    assert.equal(
      (await fixture.invoke('createLivePublicEnquiry', { body: { ...fields(), ...override } }))
        .code,
      400,
    );
  }
  assert.equal(fixture.rows.length, 0);
});

test('Marketing public ingestion retains its fixed community and email flow', async () => {
  const fixture = controllerFixture();
  const result = await fixture.invoke('createPublicEnquiry', {
    body: { ...fields(), communityKey: 'live' },
  });
  assert.equal(result.code, 201);
  assert.equal(fixture.rows[0].communityKey, 'marketing');
  assert.match(result.body.enquiryNumber, /^MKT-/);
  assert.equal(fixture.emails.length, 1);
});

test('Live employees see their own and unassigned Live enquiries; other units stay excluded', () => {
  const user = {
    _id: 'employee',
    communities: ['live'],
    roleKey: 'employee',
    officeModule: 'Sales',
  };
  const rows = [
    { communityKey: 'live', assignedTo: null, label: 'shared' },
    { communityKey: 'live', assignedTo: 'employee', label: 'own' },
    { communityKey: 'live', assignedTo: 'other', label: 'other' },
    { communityKey: 'marketing', assignedTo: null, label: 'marketing' },
  ];
  for (const scope of ['OWN', 'ASSIGNED', 'TEAM', 'DEPARTMENT']) {
    assert.deepEqual(
      rows
        .filter(sift(buildScopeQuery(user, scope, null, 'website_enquiries')))
        .map((row) => row.label),
      ['shared', 'own'],
    );
  }
  assert.deepEqual(
    rows
      .filter(
        sift(
          buildScopeQuery(
            { ...user, communities: ['marketing'] },
            'ASSIGNED',
            null,
            'website_enquiries',
          ),
        ),
      )
      .map((row) => row.label),
    ['marketing'],
  );
});

test('the first Live status update claims the enquiry and prevents another employee claiming it', async () => {
  const fixture = controllerFixture();
  await fixture.invoke('createLivePublicEnquiry', { body: fields() });
  const id = fixture.rows[0]._id;
  const user = {
    _id: '507f1f77bcf86cd799439021',
    name: 'Live Employee',
    communities: ['live'],
    roleKey: 'employee',
  };
  const request = {
    user,
    params: { id },
    body: { communityKey: 'live', status: 'Contacted', remark: 'Called visitor' },
    accessQuery: {},
  };
  assert.equal((await fixture.invoke('updateAction', request)).code, 200);
  assert.equal(fixture.rows[0].assignedTo, user._id);
  assert.equal(fixture.rows[0].remark, 'Called visitor');
  const other = {
    ...request,
    user: { ...user, _id: '507f1f77bcf86cd799439022' },
    body: { ...request.body, status: 'Interested' },
  };
  assert.equal((await fixture.invoke('updateAction', other)).code, 409);
});

test('Live ingestion is protected by the existing server secret', async (t) => {
  const express = require('express');
  const authenticate = require('../middleware/websiteIngestionAuth');
  const previous = process.env.WEBSITE_INGESTION_KEY;
  process.env.WEBSITE_INGESTION_KEY = 'test-live-website-key-'.repeat(3);
  const fixture = controllerFixture();
  const app = express();
  app.use(express.json());
  app.post(
    '/api/website-enquiries/public/live',
    authenticate,
    fixture.controller.createLivePublicEnquiry,
  );
  app.use((error, req, res, next) =>
    res.status(error.status || 500).json({ message: error.message }),
  );
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (previous === undefined) delete process.env.WEBSITE_INGESTION_KEY;
    else process.env.WEBSITE_INGESTION_KEY = previous;
  });
  const url = `http://127.0.0.1:${server.address().port}/api/website-enquiries/public/live`;
  for (const supplied of ['', 'incorrect']) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Website-Key': supplied },
      body: JSON.stringify(fields()),
    });
    assert.equal(response.status, 401);
  }
  assert.equal(fixture.rows.length, 0);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Website-Key': process.env.WEBSITE_INGESTION_KEY,
    },
    body: JSON.stringify(fields()),
  });
  assert.equal(response.status, 201);
  assert.equal(fixture.rows.length, 1);
});

test('request IDs have a unique partial index without excluding older enquiry records', () => {
  const Model = require('../models/WebsiteEnquiry');
  const index = Model.schema.indexes().find(([fields]) => fields.websiteRequestId === 1);
  assert.equal(index[1].unique, true);
  assert.equal(index[1].partialFilterExpression.websiteRequestId.$type, 'string');
  const record = new Model({
    enquiryNumber: 'LIVE-00001',
    communityKey: 'live',
    name: 'Existing visitor',
    email: 'old@example.test',
    phone: '9876543210',
  });
  assert.equal(record.validateSync(), undefined);
});
