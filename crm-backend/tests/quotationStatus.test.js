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
const setup = ({ missing = false, emailFailure = false, pdfFailure = false } = {}) => {
  const routes = {};
  const calls = { saved: 0, email: 0, audit: [], queries: [] };
  const quotation = {
    _id: quotationId,
    quotationNumber: 'TEST-001',
    clientEmail: 'client@example.test',
    status: 'Draft',
    createdBy: actorId,
    sentAt: null,
    sentBy: null,
    emailMessageId: '',
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
  for (const method of ['get', 'post', 'put', 'patch']) {
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
      findById: () => query(missing ? null : quotation),
      findOne: (filter) => {
        calls.queries.push(filter);
        return query(missing ? null : quotation);
      },
    },
    '../models/UserAccessAssignment': {
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
        { resource: 'quotations', actions: ['update', 'create'], scope: 'ALL' },
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
  assert.equal(calls.queries[0].createdBy, actorId);
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
