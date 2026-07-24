const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const Client = require('../models/Client');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const { loadAuthorization } = require('../middleware/authorization');
const { getPermission, buildScopeQuery } = require('../services/accessControlService');
const { writeAuditLog } = require('../services/auditService');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Specify the uploads folder
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Name the file with a timestamp
  },
});
const upload = multer({ storage });
const router = express.Router();
router.use(authMiddleware, loadAuthorization);

const requireClientPermission = (action) => (req, res, next) => {
  const permission = getPermission(req.effectivePermissions, 'clients', action);
  if (!permission)
    return res.status(403).json({ message: `Access denied: clients.${action} required` });
  req.clientPermission = permission;
  return next();
};

// Get all clients
router.get('/', requireClientPermission('view'), async (req, res) => {
  try {
    const query = buildScopeQuery(req.user, req.clientPermission.scope, req.selectedCommunity);
    const clients = await Client.find(query).populate('assignedTo', 'name email');
    res.json(clients);
  } catch (err) {
    console.error('Error fetching clients:', err);
    res.status(500).send('Server error');
  }
});

// Client comment route with optimized validation
router.post(
  '/:clientId/comment',
  requireClientPermission('comment'),
  upload.single('screenshotUrl'),
  async (req, res) => {
    const { comment, callStatus } = req.body;

    if (!comment || !callStatus) {
      return res.status(400).json({ message: 'Comment and call status are required.' });
    }

    try {
      const scopeQuery = buildScopeQuery(
        req.user,
        req.clientPermission.scope,
        req.selectedCommunity,
      );
      const update = {
        $push: {
          callLogs: {
            comment,
            callStatus,
            screenshotUrl: req.file ? req.file.path : null, // Handle optional screenshot
            employee: req.user.id,
          },
        },
      };

      const client = await Client.findOneAndUpdate(
        { _id: req.params.clientId, ...scopeQuery },
        update,
        {
          new: true,
          runValidators: false, // Skip other field validations
        },
      );

      if (!client)
        return res.status(404).json({ message: 'Client not found in your access scope' });
      await writeAuditLog({
        req,
        action: 'client_comment_added',
        resource: 'clients',
        resourceId: client._id,
        communityKey: client.communityKey,
      });

      res.status(200).json({ message: 'Comment submitted successfully' });
    } catch (err) {
      console.error('Error saving comment:', err.message);
      res.status(500).send('Server error');
    }
  },
);

// Fetch comments for a specific client
router.get('/:clientId/comments', requireClientPermission('view'), async (req, res) => {
  try {
    const scopeQuery = buildScopeQuery(req.user, req.clientPermission.scope, req.selectedCommunity);
    const client = await Client.findOne({ _id: req.params.clientId, ...scopeQuery }).select(
      'callLogs communityKey',
    );
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json(client);
  } catch (err) {
    console.error('Error fetching comments:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Assign clients in bulk to an employee
router.post('/assign/bulk', requireClientPermission('assign'), async (req, res) => {
  const { clientIds, employeeId } = req.body;

  try {
    const employee = await User.findOne({
      _id: employeeId,
      isDeleted: { $ne: true },
      accountStatus: 'active',
    });
    if (!employee || employee.role !== 'employee') {
      return res.status(400).json({ message: 'Invalid employee' });
    }

    const scopeQuery = buildScopeQuery(req.user, req.clientPermission.scope, req.selectedCommunity);
    const clients = await Client.find({ _id: { $in: clientIds }, ...scopeQuery }).select(
      'communityKey',
    );
    if (clients.length !== clientIds.length)
      return res.status(403).json({ message: 'One or more clients are outside your access scope' });
    if (clients.some((client) => !employee.communities.includes(client.communityKey)))
      return res
        .status(403)
        .json({ message: 'Cannot assign clients outside employee communities' });
    await Client.updateMany(
      { _id: { $in: clientIds }, ...scopeQuery },
      { $set: { assignedTo: employeeId } },
    );

    await writeAuditLog({
      req,
      targetUserId: employee._id,
      action: 'client_reassigned',
      resource: 'clients',
      resourceId: clientIds.join(','),
      newValue: { assignedTo: employee._id },
    });

    res.status(200).json({ message: 'Clients assigned successfully' });
  } catch (err) {
    console.error('Error bulk assigning clients:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all clients assigned to a specific employee
router.get('/assigned/:employeeId', requireClientPermission('view'), async (req, res) => {
  try {
    if (
      req.clientPermission.scope === 'assigned' &&
      String(req.params.employeeId) !== String(req.user._id)
    )
      return res.status(403).json({ message: "Cannot view another user's assignments" });
    const scopeQuery = buildScopeQuery(req.user, req.clientPermission.scope, req.selectedCommunity);
    const clients = await Client.find({ assignedTo: req.params.employeeId, ...scopeQuery });
    res.json(clients);
  } catch (err) {
    console.error('Error fetching assigned clients:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all assignments (for admin to see who is assigned to which clients)
router.get('/assignments', requireClientPermission('assign'), async (req, res) => {
  try {
    const scopeQuery = buildScopeQuery(req.user, req.clientPermission.scope, req.selectedCommunity);
    const assignments = await Client.find(scopeQuery).populate('assignedTo', 'name email');
    res.json(assignments);
  } catch (err) {
    console.error('Error fetching assignments:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
// Unassign a client from an employee
router.put('/:clientId/unassign', requireClientPermission('assign'), async (req, res) => {
  const { clientId } = req.params;

  try {
    // Use `findByIdAndUpdate` with $unset and disable validation for other fields
    const scopeQuery = buildScopeQuery(req.user, req.clientPermission.scope, req.selectedCommunity);
    const client = await Client.findOneAndUpdate(
      { _id: clientId, ...scopeQuery },
      { $unset: { assignedTo: '' } },
      { runValidators: false, new: true },
    );
    if (!client) return res.status(404).json({ message: 'Client not found in your access scope' });

    res.status(200).json({ message: 'Client unassigned successfully' });
  } catch (err) {
    console.error('Error unassigning client:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
