const assert = require('node:assert/strict');
const { test } = require('node:test');
const mongoose = require('mongoose');
const sift = require('sift').default;
const { applyAccessScope, requirePermission } = require('../middleware/authorization');
const { buildScopeQuery } = require('../services/accessControlService');

const user = {
  _id: new mongoose.Types.ObjectId(),
  roleKey: 'sales_executive',
  communities: ['marketing'],
  officeModule: 'Sales',
  team: 'Marketing Sales Team',
};
const other = new mongoose.Types.ObjectId();
const rows = [
  { name: 'assigned', communityKey: 'marketing', assignedTo: user._id },
  { name: 'other employee', communityKey: 'marketing', assignedTo: other },
  { name: 'unassigned', communityKey: 'marketing', assignedTo: null },
  { name: 'other unit', communityKey: 'live', assignedTo: user._id },
];

for (const scope of [
  'self',
  'OWN',
  'assigned',
  'ASSIGNED',
  'team',
  'TEAM',
  'MULTIPLE_TEAMS',
  'department',
  'DEPARTMENT',
]) {
  test(`${scope}: enquiry view/update includes direct assignments without exposing other records`, () => {
    for (const action of ['view', 'update']) {
      const req = {
        user,
        effectivePermissions: [{ resource: 'website_enquiries', actions: [action], scope }],
      };
      const res = {
        status() {
          assert.fail('Authorized employee rejected');
        },
      };
      requirePermission('website_enquiries', action)(req, res, () => {});
      applyAccessScope('website_enquiries')(req, res, () => {});
      assert.deepEqual(
        rows.filter(sift(req.accessQuery)).map((row) => row.name),
        ['assigned', 'unassigned'],
      );
      const reassigned = { ...rows[0], assignedTo: other };
      assert.equal(sift(req.accessQuery)(reassigned), false);
    }
  });
}

test('direct assignment never bypasses module permission or an explicit denial', () => {
  for (const effectivePermissions of [
    [],
    [
      {
        resource: 'website_enquiries',
        actions: ['view'],
        deniedActions: ['view'],
        scope: 'ASSIGNED',
      },
    ],
  ]) {
    let status;
    requirePermission('website_enquiries', 'view')(
      { user, effectivePermissions },
      {
        status(code) {
          status = code;
          return this;
        },
        json() {},
      },
      () => assert.fail('Missing or denied permission must not pass'),
    );
    assert.equal(status, 403);
  }
});

test('shared Marketing queue requires Marketing or Sales profile in the authorized community', () => {
  const creative = { ...user, officeModule: 'Creative' };
  assert.deepEqual(rows.filter(sift(buildScopeQuery(creative, 'ASSIGNED', null, 'website_enquiries'))).map((row) => row.name), ['assigned']);
  const liveOnly = { ...user, communities: ['live'] };
  assert.deepEqual(rows.filter(sift(buildScopeQuery(liveOnly, 'ASSIGNED', null, 'website_enquiries'))).map((row) => row.name), ['other unit']);
});

test('community/admin access and other resource scopes keep their existing behavior', () => {
  assert.equal(
    rows.filter(sift(buildScopeQuery(user, 'community', null, 'website_enquiries'))).length,
    3,
  );
  assert.equal(
    rows.filter(
      sift(buildScopeQuery({ ...user, roleKey: 'super_admin' }, 'all', null, 'website_enquiries')),
    ).length,
    4,
  );
  assert.equal(rows.filter(sift(buildScopeQuery(user, 'TEAM', null, 'clients'))).length, 0);
  assert.equal(
    rows.filter(sift(buildScopeQuery(user, 'TEAM', 'live', 'website_enquiries'))).length,
    0,
  );
});
