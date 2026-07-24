const express = require('express');
const mongoose = require('mongoose');
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const BusinessUnit = require('../models/BusinessUnit');
const Department = require('../models/Department');
const UserAccessAssignment = require('../models/UserAccessAssignment');
const authMiddleware = require('../middleware/authMiddleware');
const { loadAuthorization, requirePermission } = require('../middleware/authorization');
const { createNotification } = require('../utils/notifications');

const router = express.Router();
router.use(authMiddleware, loadAuthorization);

const activeAccessQuery = (userId) => ({
  userId,
  status: 'active',
  startDate: { $lte: new Date() },
  $or: [{ endDate: null }, { endDate: { $gte: new Date() } }],
});

const meetingPopulate = (query) =>
  query
    .populate('employee', 'name email employeeId position')
    .populate('participantUserIds', 'name email employeeId position')
    .populate('businessUnitId', 'name slug legacyCommunityKey')
    .populate('departmentId', 'name slug');

const getAccessibleOrganization = async (user) => {
  if (user.roleKey === 'super_admin') {
    const [businessUnits, departments] = await Promise.all([
      BusinessUnit.find({ status: 'active' }).sort({ name: 1 }).lean(),
      Department.find({ status: 'active' }).sort({ name: 1 }).lean(),
    ]);
    return { businessUnits, departments };
  }
  const assignments = await UserAccessAssignment.find(activeAccessQuery(user._id))
    .select('businessUnitIds departmentId')
    .lean();
  const businessUnitIds = [
    ...new Set(assignments.flatMap((assignment) => assignment.businessUnitIds.map(String))),
  ];
  const departmentIds = [
    ...new Set(
      assignments.map((assignment) => String(assignment.departmentId || '')).filter(Boolean),
    ),
  ];
  const [businessUnits, departments] = await Promise.all([
    BusinessUnit.find({ _id: { $in: businessUnitIds }, status: 'active' })
      .sort({ name: 1 })
      .lean(),
    Department.find({ _id: { $in: departmentIds }, status: 'active' })
      .sort({ name: 1 })
      .lean(),
  ]);
  return { businessUnits, departments };
};

router.get('/options', requirePermission('meetings', 'view'), async (req, res, next) => {
  try {
    const { businessUnits, departments } = await getAccessibleOrganization(req.user);
    const departmentIds = departments.map((department) => department._id);
    const businessUnitIds = businessUnits.map((unit) => unit._id);
    const memberships = await UserAccessAssignment.find({
      status: 'active',
      departmentId: { $in: departmentIds },
      businessUnitIds: { $in: businessUnitIds },
      startDate: { $lte: new Date() },
      $or: [{ endDate: null }, { endDate: { $gte: new Date() } }],
    })
      .select('userId departmentId businessUnitIds')
      .lean();
    const users = await User.find({
      _id: { $in: [...new Set(memberships.map((membership) => String(membership.userId)))] },
      userType: 'employee',
      isDeleted: { $ne: true },
      accountStatus: 'active',
    })
      .select('name email employeeId position')
      .sort({ name: 1 })
      .lean();
    const membershipMap = new Map();
    memberships.forEach((membership) => {
      const userId = String(membership.userId);
      const current = membershipMap.get(userId) || { departmentIds: [], businessUnitIds: [] };
      current.departmentIds = [
        ...new Set([...current.departmentIds, String(membership.departmentId)]),
      ];
      current.businessUnitIds = [
        ...new Set([...current.businessUnitIds, ...membership.businessUnitIds.map(String)]),
      ];
      membershipMap.set(userId, current);
    });
    return res.json({
      businessUnits,
      departments,
      employees: users.map((user) => ({
        ...user,
        ...(membershipMap.get(String(user._id)) || { departmentIds: [], businessUnitIds: [] }),
      })),
      actions:
        req.effectivePermissions.find((permission) => permission.resource === 'meetings')
          ?.actions || [],
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/', requirePermission('meetings', 'view'), async (req, res, next) => {
  try {
    let query = {};
    if (req.user.roleKey !== 'super_admin') {
      const assignments = await UserAccessAssignment.find(activeAccessQuery(req.user._id))
        .select('departmentId')
        .lean();
      const departmentIds = [
        ...new Set(assignments.map((assignment) => assignment.departmentId).filter(Boolean)),
      ];
      query = {
        $or: [
          { employee: req.user._id },
          { participantUserIds: req.user._id },
          { departmentId: { $in: departmentIds } },
        ],
      };
    }
    const meetings = await meetingPopulate(
      Meeting.find(query).sort({ meetingDate: 1, meetingTime: 1 }),
    );
    return res.json(meetings);
  } catch (error) {
    return next(error);
  }
});

router.post('/', requirePermission('meetings', 'create'), async (req, res, next) => {
  try {
    const title = String(req.body.meetingTitle || '').trim();
    const meetingDate = String(req.body.meetingDate || '').trim();
    const meetingTime = String(req.body.meetingTime || '').trim();
    const businessUnitId = String(req.body.businessUnitId || '').trim();
    const departmentId = String(req.body.departmentId || '').trim();
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(meetingDate) || !/^\d{2}:\d{2}$/.test(meetingTime))
      return res.status(400).json({ message: 'Meeting title, valid date and time are required' });
    if (!mongoose.isValidObjectId(businessUnitId) || !mongoose.isValidObjectId(departmentId))
      return res.status(400).json({ message: 'Select a valid Business Unit and Department' });
    const [businessUnit, department] = await Promise.all([
      BusinessUnit.findOne({ _id: businessUnitId, status: 'active' }),
      Department.findOne({ _id: departmentId, status: 'active' }),
    ]);
    if (
      !businessUnit ||
      !department ||
      !department.businessUnitIds.map(String).includes(String(businessUnit._id))
    )
      return res
        .status(400)
        .json({ message: 'Department is not available in the selected Business Unit' });
    if (req.user.roleKey !== 'super_admin') {
      const hasAccess = await UserAccessAssignment.exists({
        ...activeAccessQuery(req.user._id),
        departmentId: department._id,
        businessUnitIds: businessUnit._id,
      });
      if (!hasAccess)
        return res.status(403).json({
          message:
            'You cannot schedule a meeting outside your assigned Department and Business Unit',
        });
    }

    const participantIds = [
      ...new Set(
        (Array.isArray(req.body.participantUserIds) ? req.body.participantUserIds : [])
          .map(String)
          .filter((id) => mongoose.isValidObjectId(id) && id !== String(req.user._id)),
      ),
    ];
    if (participantIds.length) {
      const participantMemberships = await UserAccessAssignment.find({
        ...activeAccessQuery({ $in: participantIds }),
        departmentId: department._id,
        businessUnitIds: businessUnit._id,
      }).distinct('userId');
      if (participantMemberships.length !== participantIds.length)
        return res.status(400).json({
          message:
            'One or more participants do not belong to the selected Department and Business Unit',
        });
    }
    const conflict = await Meeting.exists({
      meetingDate,
      meetingTime,
      status: 'scheduled',
      $or: [{ employee: req.user._id }, { participantUserIds: req.user._id }],
    });
    if (conflict)
      return res
        .status(409)
        .json({ message: 'You already have another meeting scheduled at this time' });

    const meeting = await Meeting.create({
      employee: req.user._id,
      participantUserIds: participantIds,
      businessUnitId: businessUnit._id,
      departmentId: department._id,
      communityKey: businessUnit.legacyCommunityKey,
      officeModule: department.name,
      meetingTitle: title,
      meetingDate,
      meetingTime,
      durationMinutes: Math.min(480, Math.max(15, Number(req.body.durationMinutes) || 30)),
      meetingMode: ['Physical', 'Online', 'Phone'].includes(req.body.meetingMode)
        ? req.body.meetingMode
        : 'Online',
      platformOrLocation: String(req.body.platformOrLocation || '').trim(),
      notes: String(req.body.notes || '').trim(),
    });

    const actorName = req.user.name || req.user.email || 'Employee';
    await Promise.all(
      participantIds.map((participantId) =>
        createNotification({
          recipientRole: 'employee',
          recipientUser: participantId,
          actorUser: req.user._id,
          actorName,
          actorRole: req.user.role,
          type: 'meeting_scheduled',
          title: `${actorName} scheduled a meeting`,
          message: `${title} on ${meetingDate} at ${meetingTime}.`,
          link: '/employee-dashboard/meetings',
          meta: {
            meetingId: meeting._id,
            departmentId: department._id,
            businessUnitId: businessUnit._id,
          },
        }),
      ),
    );
    const populatedMeeting = await meetingPopulate(Meeting.findById(meeting._id));
    return res
      .status(201)
      .json({ message: 'Meeting scheduled successfully', meeting: populatedMeeting });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
