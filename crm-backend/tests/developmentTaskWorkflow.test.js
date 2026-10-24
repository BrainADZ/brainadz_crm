const { test } = require('node:test');
const assert = require('node:assert/strict');
const router = require('../routes/business');

const handler = router.stack.find((layer) =>
  layer.route?.path === '/:resource/:id' && layer.route.methods.patch,
).route.stack[0].handle;

const invoke = async (body, permissions = [{ resource: 'tasks', actions: ['update'], scope: 'all' }]) => {
  let status = 200;
  let data;
  await handler(
    {
      params: { resource: 'project-tasks', id: '507f1f77bcf86cd799439001' },
      user: { id: '507f1f77bcf86cd799439002', role: 'admin', roleKey: 'super_admin' },
      effectivePermissions: permissions,
      body,
    },
    {
      status(code) { status = code; return this; },
      json(value) { data = value; return this; },
    },
  );
  return { status, data };
};

test('admin cannot change task workflow even with tasks.update permission', async () => {
  for (const body of [{ status: 'Complete' }, { progress: 80 }, { status: 'Review', progress: 90 }]) {
    const result = await invoke(body);
    assert.equal(result.status, 403);
    assert.match(result.data.message, /Assigned employees/);
  }
});

test('missing task update permission remains denied', async () => {
  const result = await invoke({ status: 'Complete' }, []);
  assert.equal(result.status, 403);
  assert.match(result.data.message, /tasks.update required/);
});
