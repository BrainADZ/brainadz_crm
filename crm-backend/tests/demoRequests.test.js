const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const express = require('express');
const sift = require('sift').default;

// All database methods are stubbed: no customer records are read or written.
const setModule = (path, exports) => {
  const filename = require.resolve(path);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
};
const records = new Map();
const users = {
  live: { _id: 'live', userType: 'employee', accountStatus: 'active', roleKey: 'employee' },
  live2: { _id: 'live2', userType: 'employee', accountStatus: 'active', roleKey: 'employee' },
  noPermission: { _id: 'noPermission', userType: 'employee', accountStatus: 'active' },
  readOnly: { _id: 'readOnly', userType: 'employee', accountStatus: 'active' },
  denied: { _id: 'denied', userType: 'employee', accountStatus: 'active' },
  noAssign: {
    _id: 'noAssign',
    userType: 'employee',
    accountStatus: 'active',
    roleKey: 'company_admin',
  },
  marketing: { _id: 'marketing', userType: 'employee', accountStatus: 'active' },
  vendor: { _id: 'vendor', userType: 'vendor', accountStatus: 'active' },
  inactive: { _id: 'inactive', userType: 'employee', accountStatus: 'inactive' },
  admin: { _id: 'admin', userType: 'employee', accountStatus: 'active', roleKey: 'super_admin' },
};
const DemoModel = require('../models/DemoRequest');
setModule('../models/User', {
  findById: (id) => ({ select: async () => users[id] }),
  findOne: async (filter) =>
    Object.values(users).find((user) => String(user._id) === String(filter._id)) || null,
  find: () => ({
    select: () => ({ sort: () => ({ lean: async () => [users.live, users.live2] }) }),
  }),
});
setModule('../models/BusinessUnit', {
  findOne: () => ({ lean: async () => ({ _id: 'live-unit' }) }),
});
setModule('../services/organizationAccessService', {
  resolveUserAccess: async (id) => ({
    bypass: id === 'admin',
    businessUnitIds: ['live', 'live2', 'noPermission', 'readOnly', 'denied'].includes(id)
      ? ['live-unit']
      : ['marketing-unit'],
    assignments: [{ _id: 'managed-assignment' }],
    permissions:
      id === 'noPermission'
        ? []
        : [
            {
              resource: 'demo_requests',
              actions:
                id === 'readOnly'
                  ? ['view']
                  : id === 'noAssign'
                    ? ['view', 'update']
                    : ['view', 'update', 'assign'],
              deniedActions: id === 'denied' ? ['view'] : [],
              scopes: ['ASSIGNED'],
              sources: ['test role'],
            },
          ],
  }),
});
let lastFilter;
setModule('../models/DemoRequest', {
  findOne: async (filter) =>
    [...records.values()].find(
      (request) =>
        request._id === String(filter._id) && request.communityKey === filter.communityKey,
    ) || null,
  findOneAndUpdate: (filter, update) => {
    const existing = filter.requestId
      ? records.get(filter.requestId)
      : [...records.values()].find((request) => request._id === filter._id);
    const chain = (value) => ({
      populate: async () => value,
      then: (resolve) => Promise.resolve(value).then(resolve),
    });
    if (update.$setOnInsert) {
      if (existing) return chain(existing);
      const request = {
        ...update.$setOnInsert,
        _id: '507f1f77bcf86cd799439011',
        deliveryStatus: 'pending',
        status: 'New',
      };
      records.set(filter.requestId, request);
      return chain(request);
    }
    if (
      !existing ||
      (Object.hasOwn(filter, 'assignedTo') &&
        String(existing.assignedTo || '') !== String(filter.assignedTo || '')) ||
      (filter.status && existing.status !== filter.status)
    )
      return chain(null);
    Object.assign(existing, update.$set);
    return chain(existing);
  },
  find: (filter) => {
    lastFilter = filter;
    const chain = {
      sort: () => chain,
      skip: () => chain,
      limit: () => chain,
      populate: () => chain,
      lean: async () => [...records.values()].filter(sift(filter)),
    };
    return chain;
  },
  countDocuments: async (filter) => [...records.values()].filter(sift(filter)).length,
});

test('CRM demo ingestion and Live-only authorization', async (t) => {
  const originalKey = process.env.WEBSITE_INGESTION_KEY;
  const originalJwt = process.env.JWT_SECRET;
  process.env.WEBSITE_INGESTION_KEY = 'local-test-ingestion-key-'.repeat(3);
  process.env.JWT_SECRET = 'local-test-jwt-secret';
  const app = express();
  app.use(express.json());
  app.use('/api/demo-requests', require('../routes/demoRequests'));
  app.use((error, req, res, next) =>
    res.status(error.status || 500).json({ message: error.message }),
  );
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/demo-requests`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (originalKey === undefined) delete process.env.WEBSITE_INGESTION_KEY;
    else process.env.WEBSITE_INGESTION_KEY = originalKey;
    if (originalJwt === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwt;
  });
  const employeeHeaders = (id) => ({
    Authorization: `Bearer ${jwt.sign({ user: { id } }, process.env.JWT_SECRET)}`,
  });
  const websiteHeaders = {
    'Content-Type': 'application/json',
    'X-Website-Key': process.env.WEBSITE_INGESTION_KEY,
  };
  const body = {
    requestId: randomUUID(),
    name: 'Visitor',
    email: 'visitor@example.com',
    phone: '+919876543210',
    companyName: 'Example Company',
    companySize: '11-50 employees',
    requirements: 'Inventory',
    demoType: 'erp',
    industry: 'Must be ignored',
    password: 'Must not be stored',
    communityKey: 'marketing',
  };

  await t.test('ingestion requires the shared server secret', async () => {
    assert.equal(
      (
        await fetch(`${base}/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      ).status,
      401,
    );
    assert.equal(records.size, 0);
  });
  await t.test('ingestion stores only whitelisted fields in Live', async () => {
    const response = await fetch(`${base}/ingest`, {
      method: 'POST',
      headers: websiteHeaders,
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 200);
    const { request } = await response.json();
    assert.equal(request.companyName, body.companyName);
    assert.equal(request.communityKey, 'live');
    assert.equal(request.password, undefined);
    assert.equal(request.industry, undefined);
    assert.equal(new DemoModel(request).validateSync(), undefined);
  });
  await t.test('retries do not duplicate a lead or overwrite different contact data', async () => {
    assert.equal(
      (
        await fetch(`${base}/ingest`, {
          method: 'POST',
          headers: websiteHeaders,
          body: JSON.stringify(body),
        })
      ).status,
      200,
    );
    assert.equal(records.size, 1);
    assert.equal(
      (
        await fetch(`${base}/ingest`, {
          method: 'POST',
          headers: websiteHeaders,
          body: JSON.stringify({ ...body, email: 'other@example.com' }),
        })
      ).status,
      409,
    );
  });
  await t.test('only Live employees and all-unit employee admins can view requests', async () => {
    assert.equal((await fetch(base)).status, 401);
    for (const id of ['marketing', 'vendor', 'inactive']) {
      assert.equal((await fetch(base, { headers: employeeHeaders(id) })).status, 403);
      assert.equal(
        (
          await fetch(`${base}/507f1f77bcf86cd799439011`, {
            method: 'PATCH',
            headers: { ...employeeHeaders(id), 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Closed', notes: '' }),
          })
        ).status,
        403,
      );
    }
    for (const id of ['live', 'admin']) {
      assert.equal((await fetch(base, { headers: employeeHeaders(id) })).status, 200);
      assert.equal(
        (await (await fetch(`${base}/access`, { headers: employeeHeaders(id) })).json()).allowed,
        true,
      );
    }
    assert.equal(
      (await (await fetch(`${base}/access`, { headers: employeeHeaders('marketing') })).json())
        .allowed,
      false,
    );
  });
  await t.test('permission catalogue includes Demo Requests as its own module', () => {
    const { MODULES, PERMISSION_RESOURCES } = require('../config/accessControl');
    assert.ok(PERMISSION_RESOURCES.includes('demo_requests'));
    assert.deepEqual(MODULES.find((module) => module.key === 'demo_requests').resources, [
      'demo_requests',
    ]);
  });
  await t.test('Live membership cannot bypass missing or denied View permission', async () => {
    for (const id of ['noPermission', 'denied']) {
      const headers = employeeHeaders(id);
      const access = await (await fetch(`${base}/access`, { headers })).json();
      assert.deepEqual(access, { allowed: false, canUpdate: false, canAssign: false });
      assert.equal((await fetch(base, { headers })).status, 403);
      assert.equal((await fetch(`${base}/options`, { headers })).status, 403);
      for (const suffix of ['', '/assign']) {
        const response = await fetch(`${base}/507f1f77bcf86cd799439011${suffix}`, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Closed', notes: '', employeeId: null }),
        });
        assert.equal(response.status, 403);
      }
    }
  });
  await t.test('View-only employee can read but cannot update or assign', async () => {
    const headers = employeeHeaders('readOnly');
    const access = await (await fetch(`${base}/access`, { headers })).json();
    assert.deepEqual(access, { allowed: true, canUpdate: false, canAssign: false });
    assert.equal((await fetch(base, { headers })).status, 200);
    const response = await fetch(`${base}/507f1f77bcf86cd799439011`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Closed', notes: '' }),
    });
    assert.equal(response.status, 403);
  });
  await t.test('Admin title cannot bypass missing Assign permission', async () => {
    const headers = employeeHeaders('noAssign');
    const access = await (await fetch(`${base}/access`, { headers })).json();
    assert.deepEqual(access, { allowed: true, canUpdate: true, canAssign: false });
    assert.equal((await fetch(`${base}/options`, { headers })).status, 403);
    const response = await fetch(`${base}/507f1f77bcf86cd799439011/assign`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: null }),
    });
    assert.equal(response.status, 403);
  });
  await t.test('list filters always retain Live scope and escape search regex', async () => {
    const response = await fetch(
      `${base}?communityKey=marketing&search=%5Ba%5D&status=Contacted&deliveryStatus=failed`,
      { headers: employeeHeaders('live') },
    );
    assert.equal(response.status, 200);
    assert.equal(lastFilter.communityKey, 'live');
    assert.equal(lastFilter.status, 'Contacted');
    assert.equal(lastFilter.deliveryStatus, 'failed');
    assert.equal(lastFilter.$or[0].name.source, '\\[a\\]');
  });
  await t.test('Live employees can update only follow-up status and notes', async () => {
    const headers = { ...employeeHeaders('live'), 'Content-Type': 'application/json' };
    const response = await fetch(`${base}/507f1f77bcf86cd799439011`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        status: 'Contacted',
        notes: 'Demo discussed',
        companyName: 'Cannot overwrite',
      }),
    });
    assert.equal(response.status, 200);
    const { request } = await response.json();
    assert.equal(request.status, 'Contacted');
    assert.equal(request.notes, 'Demo discussed');
    assert.equal(request.updatedBy, 'live');
    assert.equal(request.assignedTo, 'live');
    assert.equal(request.companyName, body.companyName);
    assert.equal(
      (
        await fetch(`${base}/507f1f77bcf86cd799439011`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: 'Unknown', notes: '' }),
        })
      ).status,
      400,
    );
  });
  await t.test(
    'first status update owns the request; another employee cannot take it',
    async () => {
      const headers = { ...employeeHeaders('live2'), 'Content-Type': 'application/json' };
      const response = await fetch(`${base}/507f1f77bcf86cd799439011`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'Qualified', notes: 'Attempted takeover' }),
      });
      assert.equal(response.status, 409);
      assert.equal(records.get(body.requestId).assignedTo, 'live');
      const forbidden = await fetch(`${base}/507f1f77bcf86cd799439011/assign`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ employeeId: null }),
      });
      assert.equal(forbidden.status, 403);
      const sharedQueue = await (await fetch(base, { headers: employeeHeaders('live2') })).json();
      const ownerQueue = await (await fetch(base, { headers: employeeHeaders('live') })).json();
      assert.equal(sharedQueue.total, 0);
      assert.equal(ownerQueue.total, 1);
    },
  );
  await t.test('Super Admin can unassign a claimed request', async () => {
    const response = await fetch(`${base}/507f1f77bcf86cd799439011/assign`, {
      method: 'PATCH',
      headers: { ...employeeHeaders('admin'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: null }),
    });
    assert.equal(response.status, 200);
    assert.equal(records.get(body.requestId).assignedTo, null);
  });
  await t.test(
    'delivery updates do not permit modifying lead fields or adding passwords',
    async () => {
      const response = await fetch(`${base}/ingest/${body.requestId}`, {
        method: 'PATCH',
        headers: websiteHeaders,
        body: JSON.stringify({
          deliveryStatus: 'sent',
          accessType: 'account',
          demoUrl: 'https://demo.example.com',
          companyName: 'Wrong',
          password: 'Wrong',
        }),
      });
      assert.equal(response.status, 200);
      const { request } = await response.json();
      assert.equal(request.companyName, body.companyName);
      assert.equal(request.password, undefined);
      assert.ok(request.emailedAt);
      assert.equal(request.deliveryStatus, 'sent');
    },
  );
});
