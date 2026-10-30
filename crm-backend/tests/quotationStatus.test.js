const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const vm = require('node:vm');

const routePath = path.resolve(__dirname, '../routes/quotations.js');
const routeRequire = createRequire(routePath);
const Quotation = routeRequire('../models/Quotation');
const actorId = '507f1f77bcf86cd799439011';
const quotationId = '507f1f77bcf86cd799439012';

// Run real route handlers and permission checks with isolated database/email boundaries.
const setup = ({
  missing = false,
  emailFailure = false,
  pdfFailure = false,
  deleteFailure = false,
  deletedCount = 1,
  validBackup = true,
} = {}) => {
  const routes = {};
  const calls = {
    saved: 0,
    email: 0,
    audit: [],
    queries: [],
    deleted: [],
    created: [],
    counts: [],
  };
  const unit = { _id: '507f1f77bcf86cd799439013', legacyCommunityKey: 'live' };
  const department = {
    _id: '507f1f77bcf86cd799439014',
    name: 'Sales',
    businessUnitIds: [unit._id],
  };
  const quotation = {
    _id: quotationId,
    quotationNumber: 'TEST-001',
    clientEmail: 'client@example.test',
    status: 'Draft',
    createdBy: actorId,
    sentAt: null,
    sentBy: null,
    emailMessageId: '',
    businessUnitId: unit._id,
    departmentId: department._id,
    async save() {
      calls.saved += 1;
    },
  };
  const query = (value) => ({
    populate() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  });
  const router = { use() {} };
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    router[method] = (url, ...handlers) => {
      routes[`${method} ${url}`] = handlers;
    };
  }
  const generatePdf = async () => {
    if (pdfFailure) throw new Error('PDF generation failed');
    return Buffer.from('%PDF-test');
  };
  const stubs = {
    express: { Router: () => router },
    '../models/Quotation': {
      schema: Quotation.schema,
      countDocuments: async (filter) => {
        calls.counts.push(filter);
        return 2;
      },
      create: async (value) => {
        calls.created.push(value);
        Object.assign(quotation, value);
        return quotation;
      },
      findById: () => query(missing ? null : quotation),
      findOne: (filter) => {
        calls.queries.push(filter);
        return query(missing ? null : quotation);
      },
      deleteOne: async (filter) => {
        calls.deleted.push(filter);
        if (deleteFailure) throw new Error('Database unavailable');
        return { deletedCount };
      },
    },
    '../models/Counter': { findOneAndUpdate: async () => ({ value: 1 }) },
    '../models/User': {
      exists: async () => validBackup,
      find: () => ({ select: () => ({ sort: () => ({ lean: async () => [] }) }) }),
    },
    '../models/BusinessUnit': {
      findOne: async () => unit,
      find: () => ({ sort: () => ({ lean: async () => [] }) }),
    },
    '../models/Department': {
      findOne: async () => department,
      find: () => ({ sort: () => ({ lean: async () => [] }) }),
    },
    '../models/UserAccessAssignment': {
      exists: async () => validBackup,
      find: () => ({ select: () => ({ lean: async () => [] }) }),
    },
    '../services/quotationPdfService': { generateQuotationPdf: generatePdf },
    '../services/socialMediaProposalPdfService': { generateSocialMediaProposalPdf: generatePdf },
    '../services/emailService': {
      sendQuotationEmail: async () => {
        calls.email += 1;
        assert.equal(quotation.status, 'Draft', 'Status must remain Draft until email succeeds');
        if (emailFailure) throw new Error('SMTP unavailable');
        return { messageId: 'test-message' };
      },
    },
    '../services/auditService': { writeAuditLog: async (entry) => calls.audit.push(entry) },
  };
  vm.runInNewContext(
    fs.readFileSync(routePath, 'utf8'),
    {
      require: (name) => stubs[name] || routeRequire(name),
      module: { exports: {} },
      process,
    },
    { filename: routePath },
  );
  const request = async (route, body = {}, overrides = {}) => {
    const req = {
      body,
      params: { id: quotationId },
      user: { _id: actorId, roleKey: 'super_admin' },
      effectivePermissions: [
        { resource: 'quotations', actions: ['view', 'update', 'create', 'delete'], scope: 'ALL' },
      ],
      ...overrides,
    };
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(value) {
        this.body = value;
        return this;
      },
    };
    for (const handler of routes[route]) {
      let continueRoute = false;
      await handler(req, res, (error) => {
        if (error) res.error = error;
        else continueRoute = true;
      });
      if (!continueRoute) break;
    }
    return res;
  };
  return { request, quotation, calls };
};

for (const status of ['Draft', 'Sent']) {
  test(`admin can delete a ${status} quotation with an audit record`, async () => {
    const { request, quotation, calls } = setup();
    quotation.status = status;
    const result = await request('delete /:id');
    assert.equal(result.statusCode, 200);
    assert.match(result.body.message, /TEST-001 deleted successfully/);
    assert.equal(calls.deleted.length, 1);
    assert.equal(calls.deleted[0]._id, quotationId);
    assert.equal(calls.audit[0].action, 'quotation_deleted');
    assert.equal(calls.audit[0].previousValue.status, status);
    assert.equal(calls.email, 0);
  });
}

test('employee cannot delete even with a delegated delete permission', async () => {
  const { request, calls } = setup();
  const result = await request('delete /:id', {}, { user: { _id: actorId, roleKey: 'employee' } });
  assert.equal(result.statusCode, 403);
  assert.equal(calls.deleted.length, 0);
});

test('delete permission denies and missing permissions are respected', async () => {
  for (const permissions of [
    [],
    [{ resource: 'quotations', actions: ['delete'], deniedActions: ['delete'], scope: 'all' }],
  ]) {
    const { request, calls } = setup();
    const result = await request('delete /:id', {}, { effectivePermissions: permissions });
    assert.equal(result.statusCode, 403);
    assert.equal(calls.deleted.length, 0);
  }
});

test('unknown or invalid quotation ID does not delete anything', async () => {
  for (const options of [{ missing: true }, {}]) {
    const { request, calls } = setup(options);
    const result = await request(
      'delete /:id',
      {},
      { params: { id: options.missing ? quotationId : 'invalid-id' } },
    );
    assert.equal(result.statusCode, 404);
    assert.equal(calls.deleted.length, 0);
  }
});

test('failed deletion and already deleted records do not report success or audit a deletion', async () => {
  for (const options of [{ deleteFailure: true }, { deletedCount: 0 }]) {
    const { request, calls } = setup(options);
    const result = await request('delete /:id');
    if (options.deleteFailure) assert.match(result.error.message, /Database unavailable/);
    else assert.equal(result.statusCode, 404);
    assert.equal(calls.audit.length, 0);
  }
});

test('options enable deletion only for an admin with delete permission', async () => {
  for (const [roleKey, actions, expected] of [
    ['super_admin', ['view', 'delete'], true],
    ['super_admin', ['view'], false],
    ['employee', ['view', 'delete'], false],
  ]) {
    const { request } = setup();
    const result = await request(
      'get /options',
      {},
      {
        user: { _id: actorId, roleKey },
        effectivePermissions: [{ resource: 'quotations', actions, scope: 'all' }],
      },
    );
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.canDelete, expected);
  }
});

for (const status of Quotation.schema.path('status').enumValues) {
  test(`manual status ${status} saves without sending email or replacing delivery history`, async () => {
    const { request, quotation, calls } = setup();
    quotation.status = status === 'Draft' ? 'Sent' : 'Draft';
    const previousStatus = quotation.status;
    quotation.sentAt = new Date('2026-09-17T10:00:00Z');
    quotation.sentBy = actorId;
    quotation.emailMessageId = 'previous-email';
    const result = await request('patch /:id/status', { status, grandTotal: 0 });
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.quotation.status, status);
    assert.equal(calls.saved, 1);
    assert.equal(calls.email, 0);
    assert.equal(quotation.emailMessageId, 'previous-email');
    assert.equal(quotation.sentAt.toISOString(), '2026-09-17T10:00:00.000Z');
    assert.equal(quotation.sentBy, actorId);
    assert.equal(quotation.grandTotal, undefined);
    assert.equal(calls.audit[0].previousValue.status, previousStatus);
    assert.equal(calls.audit[0].newValue.status, status);
  });
}

test('invalid status and missing status are rejected without writes', async () => {
  const { request, calls } = setup();
  for (const status of ['sent', 'Unknown', null, undefined, { status: 'Sent' }]) {
    const result = await request('patch /:id/status', { status });
    assert.equal(result.statusCode, 400);
  }
  assert.equal(calls.saved, 0);
});

test('manual changes require update permission', async () => {
  const { request, calls } = setup();
  const result = await request(
    'patch /:id/status',
    { status: 'Sent' },
    {
      effectivePermissions: [{ resource: 'quotations', actions: ['view', 'create'], scope: 'ALL' }],
    },
  );
  assert.equal(result.statusCode, 403);
  assert.equal(calls.saved, 0);
});

test('own scope is applied and inaccessible quotation cannot be changed', async () => {
  const { request, calls } = setup({ missing: true });
  const result = await request(
    'patch /:id/status',
    { status: 'Sent' },
    {
      user: { _id: actorId, roleKey: 'employee' },
      effectivePermissions: [{ resource: 'quotations', actions: ['update'], scope: 'OWN' }],
    },
  );
  assert.equal(result.statusCode, 404);
  assert.equal(calls.queries[0].$or[0].createdBy, actorId);
  assert.equal(calls.queries[0].$or[1].backupEmployee, actorId);
  assert.equal(calls.saved, 0);
});

test('selecting the current status does not create duplicate writes', async () => {
  const { request, calls } = setup();
  const result = await request('patch /:id/status', { status: 'Draft' });
  assert.equal(result.statusCode, 200);
  assert.equal(calls.saved, 0);
  assert.equal(calls.audit.length, 0);
});

test('successful send automatically persists Sent and returns it to the UI', async () => {
  const { request, quotation, calls } = setup();
  const result = await request('post /:id/send');
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.quotation.status, 'Sent');
  assert.equal(calls.saved, 1);
  assert.equal(calls.email, 1);
  assert.ok(quotation.sentAt);
  assert.equal(quotation.sentBy, actorId);
  assert.equal(quotation.emailMessageId, 'test-message');
});

for (const failure of ['emailFailure', 'pdfFailure']) {
  test(`${failure} does not mark quotation Sent`, async () => {
    const { request, quotation, calls } = setup({ [failure]: true });
    const result = await request('post /:id/send');
    assert.ok(result.error);
    assert.equal(quotation.status, 'Draft');
    assert.equal(quotation.sentAt, null);
    assert.equal(calls.saved, 0);
    assert.equal(calls.email, failure === 'emailFailure' ? 1 : 0);
  });
}

const validBody = {
  businessUnitId: '507f1f77bcf86cd799439013',
  departmentId: '507f1f77bcf86cd799439014',
  clientName: 'Test client',
  quotationDate: '2026-10-30',
  validUntil: '2026-11-14',
  items: [{ description: 'Service', quantity: 1, unitRate: 100, taxRate: 18 }],
};
const employee = { user: { _id: actorId, roleKey: 'employee' } };
const otherId = '507f1f77bcf86cd799439015';

for (const status of ['Sale', 'Accepted']) {
  for (const route of ['put /:id', 'patch /:id/status', 'post /:id/send']) {
    test(status + ' blocks ' + route + ' even for admins', async () => {
      const { request, quotation, calls } = setup();
      quotation.status = status;
      const result = await request(route, { ...validBody, status: 'Draft' });
      assert.equal(result.error?.status, 409);
      assert.equal(quotation.status, status);
      assert.equal(calls.saved, 0);
      assert.equal(calls.email, 0);
    });
  }
}

test('sale is credited to the employee marking it, including a backup employee', async () => {
  const { request, quotation, calls } = setup();
  quotation.createdBy = otherId;
  quotation.backupEmployee = actorId;
  const result = await request('patch /:id/status', { status: 'Sale' }, employee);
  assert.equal(result.statusCode, 200);
  assert.equal(quotation.soldBy, actorId);
  assert.ok(quotation.soldAt);
  assert.equal(calls.saved, 1);
});

test('conversion endpoint counts only the current employee sales', async () => {
  const { request, calls } = setup();
  const result = await request(
    'get /my-conversions',
    {},
    { ...employee, effectivePermissions: [] },
  );
  assert.equal(result.body.converted, 2);
  assert.equal(calls.counts[0].soldBy, actorId);
  assert.equal(calls.counts[0].status, 'Sale');
});

for (const route of ['put /:id', 'patch /:id/status', 'post /:id/send']) {
  test('unassigned employee cannot mutate via ' + route, async () => {
    const { request, quotation, calls } = setup();
    quotation.createdBy = otherId;
    const result = await request(route, { ...validBody, status: 'Sent' }, employee);
    assert.equal(result.error?.status, 403);
    assert.equal(calls.saved, 0);
    assert.equal(calls.email, 0);
  });
}

test('creation saves the selected backup without treating creation as a revision', async () => {
  const { request, quotation, calls } = setup();
  const result = await request('post /', { ...validBody, backupEmployee: otherId }, employee);
  assert.equal(result.statusCode, 201);
  assert.equal(calls.created[0].backupEmployee, otherId);
  assert.equal(quotation.lastRevisedAt, undefined);
});

test('invalid or out-of-organization backup assignment is rejected', async () => {
  for (const backupEmployee of ['invalid-id', otherId]) {
    const { request, calls } = setup({ validBackup: false });
    const result = await request('post /', { ...validBody, backupEmployee });
    assert.equal(result.error?.status, 400);
    assert.equal(calls.created.length, 0);
  }
});

test('backup employee can revise and the server records the latest revision time', async () => {
  const { request, quotation, calls } = setup();
  quotation.createdBy = otherId;
  quotation.backupEmployee = actorId;
  quotation.lastRevisedAt = new Date('2026-01-01');
  const result = await request(
    'put /:id',
    { ...validBody, backupEmployee: actorId, lastRevisedAt: '2000-01-01' },
    employee,
  );
  assert.equal(result.statusCode, 200);
  assert.equal(calls.saved, 1);
  assert.ok(quotation.lastRevisedAt.getTime() > new Date('2026-01-01').getTime());
  assert.equal(quotation.backupEmployee, actorId);
});

test('backup employee cannot reassign the quotation', async () => {
  const { request, quotation, calls } = setup();
  quotation.createdBy = otherId;
  quotation.backupEmployee = actorId;
  const result = await request('put /:id', { ...validBody, backupEmployee: otherId }, employee);
  assert.equal(result.statusCode, 403);
  assert.equal(calls.saved, 0);
});
