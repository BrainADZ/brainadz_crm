const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

const stub = (path, exports) => {
  const filename = require.resolve(path);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
};
const ids = {
  admin: '507f1f77bcf86cd799439001',
  organizer: '507f1f77bcf86cd799439002',
  participant: '507f1f77bcf86cd799439003',
  manager: '507f1f77bcf86cd799439004',
  outsider: '507f1f77bcf86cd799439005',
  reader: '507f1f77bcf86cd799439006',
  meeting: '507f1f77bcf86cd799439101',
  otherMeeting: '507f1f77bcf86cd799439102',
  unit: '507f1f77bcf86cd799439201',
  department: '507f1f77bcf86cd799439202',
};
const users = Object.fromEntries(
  Object.entries(ids)
    .filter(([key]) => !['meeting', 'otherMeeting', 'unit', 'department'].includes(key))
    .map(([key, id]) => [
      id,
      {
        _id: id,
        name: key,
        email: `${key}@example.test`,
        role: key === 'admin' ? 'admin' : 'employee',
        roleKey: key === 'admin' ? 'super_admin' : 'employee',
        userType: 'employee',
        accountStatus: 'active',
        sessionVersion: 0,
      },
    ]),
);

let records;
let deleteCalls = 0;
const resetRecords = () => {
  records = [
    {
      _id: ids.meeting,
      employee: ids.organizer,
      participantUserIds: [ids.participant],
      businessUnitId: ids.unit,
      departmentId: ids.department,
      communityKey: 'live',
      meetingTitle: 'ERP review',
      meetingDate: '2099-10-20',
      meetingTime: '15:00',
      meetingMode: 'Online',
      platformOrLocation: 'https://meet.google.com/abc-defg-hij',
      status: 'scheduled',
      notes: 'Review accounts and inventory',
    },
    {
      _id: ids.otherMeeting,
      employee: ids.reader,
      participantUserIds: [],
      businessUnitId: ids.unit,
      departmentId: ids.department,
      communityKey: 'marketing',
      meetingTitle: 'Private review',
      meetingMode: 'Physical',
      status: 'scheduled',
    },
  ];
  deleteCalls = 0;
};
const equals = (left, right) => String(left?._id || left) === String(right?._id || right);
const matches = (document, filter = {}) =>
  Object.entries(filter).every(([key, expected]) => {
    if (key === '$and') return expected.every((part) => matches(document, part));
    if (key === '$or') return expected.some((part) => matches(document, part));
    const values = Array.isArray(document[key]) ? document[key] : [document[key]];
    if (expected?.$in)
      return values.some((value) => expected.$in.some((item) => equals(value, item)));
    return values.some((value) => equals(value, expected));
  });
const query = (read) => {
  let populated = false;
  const chain = {
    select: () => chain,
    sort: () => chain,
    populate: () => {
      populated = true;
      return chain;
    },
    lean: () => Promise.resolve(read()),
    then: (resolve, reject) =>
      Promise.resolve()
        .then(() => {
          const result = read();
          const convert = (record) => {
            if (!record || !populated) return record;
            return {
              ...record,
              employee: users[record.employee],
              participantUserIds: record.participantUserIds.map((id) => users[id]),
            };
          };
          return Array.isArray(result) ? result.map(convert) : convert(result);
        })
        .then(resolve, reject),
  };
  return chain;
};
stub('../models/User', {
  findById: (id) => ({ select: async () => (users[id] ? { ...users[id] } : null) }),
  find: () => query(() => []),
});
stub('../models/Meeting', {
  find: (filter) => query(() => records.filter((record) => matches(record, filter))),
  findOne: (filter) =>
    query(() => {
      const record = records.find((item) => matches(item, filter));
      if (record) record.save = async () => record;
      return record || null;
    }),
  findById: (id) => query(() => records.find((item) => item._id === id) || null),
  findOneAndDelete: async (filter) => {
    deleteCalls += 1;
    const index = records.findIndex((record) => matches(record, filter));
    return index < 0 ? null : records.splice(index, 1)[0];
  },
});
stub('../models/BusinessUnit', { find: () => query(() => []) });
stub('../models/Department', { find: () => query(() => []) });
stub('../models/ClientDataset', {});
stub('../models/UserAccessAssignment', {
  find: () =>
    query(() => [{ businessUnitIds: [ids.unit], departmentId: ids.department, teamIds: [] }]),
});
stub('../services/meetingReminderService', { getDateInTimeZone: () => '2026-10-19' });
stub('../utils/notifications', { createNotification: async () => {} });
stub('../middleware/authorization', {
  loadAuthorization: (req, res, next) => {
    const actions = req.user._id === ids.reader ? ['view'] : ['view', 'edit', 'create', 'delete'];
    req.effectivePermissions = [{ resource: 'meetings', actions }];
    req.selectedCommunity = req.get('X-Community-Key') || '';
    next();
  },
  requirePermission: (resource, action) => (req, res, next) => {
    if (!req.effectivePermissions.some((permission) => permission.actions.includes(action)))
      return res.status(403).json({ message: 'Permission denied' });
    req.permission = { scope: [ids.admin, ids.manager].includes(req.user._id) ? 'COMPANY' : 'OWN' };
    next();
  },
});

test('meeting details, join links and owner-only deletion', async (t) => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-only-meeting-actions-secret';
  const app = express();
  app.use(express.json());
  app.use('/api/meetings', require('../routes/meetings'));
  app.use((error, req, res, next) =>
    res.status(error.status || 500).json({ message: error.message }),
  );
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/meetings`;
  const headers = (key) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${jwt.sign({ user: { id: ids[key] } }, process.env.JWT_SECRET)}`,
  });
  t.beforeEach(resetRecords);
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  await t.test('details require authentication and reject invalid IDs', async () => {
    assert.equal((await fetch(`${base}/${ids.meeting}`)).status, 401);
    assert.equal((await fetch(`${base}/invalid`, { headers: headers('organizer') })).status, 400);
  });
  await t.test(
    'organizer and participant can open details; unrelated employees cannot',
    async () => {
      for (const key of ['organizer', 'participant']) {
        const response = await fetch(`${base}/${ids.meeting}`, { headers: headers(key) });
        assert.equal(response.status, 200);
        const data = await response.json();
        assert.equal(data.meeting.meetingTitle, 'ERP review');
        assert.equal(data.canDelete, false);
        assert.equal(data.canEditLink, key === 'organizer');
      }
      assert.equal(
        (await fetch(`${base}/${ids.meeting}`, { headers: headers('outsider') })).status,
        404,
      );
    },
  );
  await t.test('list and details apply the same meeting scope and selected community', async () => {
    const list = await (await fetch(base, { headers: headers('organizer') })).json();
    assert.deepEqual(
      list.map((meeting) => meeting._id),
      [ids.meeting],
    );
    assert.equal(
      (await fetch(`${base}/${ids.otherMeeting}`, { headers: headers('organizer') })).status,
      404,
    );
    assert.equal(
      (
        await fetch(`${base}/${ids.meeting}`, {
          headers: { ...headers('admin'), 'X-Community-Key': 'marketing' },
        })
      ).status,
      404,
    );
  });
  await t.test('only super admin sees deletion capability', async () => {
    const data = await (
      await fetch(`${base}/${ids.meeting}`, { headers: headers('admin') })
    ).json();
    assert.equal(data.canDelete, true);
    assert.equal(data.canEditLink, true);
    const manager = await (
      await fetch(`${base}/${ids.meeting}`, { headers: headers('manager') })
    ).json();
    assert.equal(manager.canDelete, false);
    assert.equal(manager.canEditLink, false);
  });
  await t.test(
    'even organizers and managers with delegated delete permission cannot delete',
    async () => {
      for (const key of ['organizer', 'participant', 'manager', 'outsider']) {
        assert.equal(
          (await fetch(`${base}/${ids.meeting}`, { method: 'DELETE', headers: headers(key) }))
            .status,
          403,
        );
      }
      assert.equal(records.length, 2);
      assert.equal(deleteCalls, 0);
    },
  );
  await t.test('super admin can delete, then the meeting disappears', async () => {
    assert.equal(
      (await fetch(`${base}/${ids.meeting}`, { method: 'DELETE', headers: headers('admin') }))
        .status,
      200,
    );
    assert.equal(records.length, 1);
    assert.equal(
      (await fetch(`${base}/${ids.meeting}`, { headers: headers('admin') })).status,
      404,
    );
    assert.equal(
      (await fetch(`${base}/${ids.meeting}`, { method: 'DELETE', headers: headers('admin') }))
        .status,
      404,
    );
  });
  await t.test('organizer can repair a link without overwriting meeting fields', async () => {
    const response = await fetch(`${base}/${ids.meeting}/link`, {
      method: 'PATCH',
      headers: headers('organizer'),
      body: JSON.stringify({
        platformOrLocation: 'https://meet.google.com/new-link',
        meetingTitle: 'Must be ignored',
        employee: ids.outsider,
      }),
    });
    assert.equal(response.status, 200);
    const { meeting } = await response.json();
    assert.equal(meeting.platformOrLocation, 'https://meet.google.com/new-link');
    assert.equal(meeting.meetingTitle, 'ERP review');
    assert.equal(meeting.employee._id, ids.organizer);
  });
  await t.test('participants and managers cannot change someone else’s link', async () => {
    for (const key of ['participant', 'manager']) {
      assert.equal(
        (
          await fetch(`${base}/${ids.meeting}/link`, {
            method: 'PATCH',
            headers: headers(key),
            body: JSON.stringify({ platformOrLocation: 'https://example.com/meeting' }),
          })
        ).status,
        403,
      );
    }
  });
  await t.test('unsafe links and missing online links are rejected', async () => {
    for (const value of [
      'javascript:alert(1)',
      'data:text/html,test',
      'plain-text',
      'https://user:password@example.com/meeting',
    ]) {
      assert.equal(
        (
          await fetch(`${base}/${ids.meeting}/link`, {
            method: 'PATCH',
            headers: headers('admin'),
            body: JSON.stringify({ platformOrLocation: value }),
          })
        ).status,
        400,
      );
    }
    const response = await fetch(base, {
      method: 'POST',
      headers: headers('admin'),
      body: JSON.stringify({
        meetingTitle: 'Online review',
        meetingDate: '2099-10-20',
        meetingTime: '15:00',
        meetingMode: 'Online',
        platformOrLocation: 'not-a-link',
      }),
    });
    assert.equal(response.status, 400);
  });
  await t.test(
    'backend and Join button accept the same valid links and reject unsafe values',
    async () => {
      const { normalizeMeetingLink } = require('../services/meetingLinkService');
      const { getMeetingJoinUrl } = await import('../../crm-dashboard/src/utils/meetingLinks.js');
      for (const value of [
        'https://meet.google.com/abc-defg-hij',
        'meet.google.com/abc-defg-hij',
        'https://us02web.zoom.us/j/123456',
        'teams.microsoft.com/l/meetup-join/test',
        'javascript:alert(1)',
        'not-a-url',
        'https://user:pass@example.com/meeting',
        '',
      ]) {
        assert.equal(
          getMeetingJoinUrl({ meetingMode: 'Online', platformOrLocation: value }),
          normalizeMeetingLink(value),
        );
      }
      assert.equal(
        getMeetingJoinUrl({ meetingMode: 'Physical', platformOrLocation: 'https://example.com' }),
        '',
      );
      assert.equal(
        getMeetingJoinUrl({
          meetingMode: 'Online',
          status: 'cancelled',
          platformOrLocation: 'https://example.com',
        }),
        '',
      );
    },
  );
});
