const express = require('express');
const mongoose = require('mongoose');
const Meeting = require('../models/Meeting');
const ClientDataset = require('../models/ClientDataset');
const User = require('../models/User');
const BusinessUnit = require('../models/BusinessUnit');
const Department = require('../models/Department');
const UserAccessAssignment = require('../models/UserAccessAssignment');
const authMiddleware = require('../middleware/authMiddleware');
const { loadAuthorization, requirePermission } = require('../middleware/authorization');
const { createNotification } = require('../utils/notifications');
const { getPermission } = require('../services/accessControlService');
const { getDateInTimeZone } = require('../services/meetingReminderService');

const router = express.Router();
router.use(authMiddleware, loadAuthorization);

const activeAccessQuery = (userId) => ({
  userId,
  status: 'active',
  startDate: { $lte: new Date() },
  $or: [{ endDate: null }, { endDate: { $gte: new Date() } }],
});

const ASSIGNED_SCOPES = new Set(['assigned', 'ASSIGNED', 'self', 'OWN']);
const TEAM_SCOPES = new Set(['team', 'TEAM', 'MULTIPLE_TEAMS']);
const DEPARTMENT_SCOPES = new Set(['department', 'DEPARTMENT']);
const BUSINESS_UNIT_SCOPES = new Set([
  'community',
  'BUSINESS_UNIT',
  'MULTIPLE_BUSINESS_UNITS',
]);
const COMPANY_SCOPES = new Set(['all', 'COMPANY']);
const CLIENT_WORK_COLUMNS = ['Status', 'Remark', 'Employee'];

const normalizeCell = (value) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
};

const normalizeColumnName = (value) => normalizeCell(value).toLowerCase();

const isValidDateKey = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1000) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const isValidTimeKey = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const addWorkColumnsAfterWebsite = (columns = [], rows = []) => {
  const normalizedColumns = columns.map(
    (column, index) => normalizeCell(column) || `Column ${index + 1}`,
  );
  const workIndexes = new Map(
    CLIENT_WORK_COLUMNS.map((column) => [
      column,
      normalizedColumns.findIndex(
        (item) => normalizeColumnName(item) === column.toLowerCase(),
      ),
    ]),
  );
  const dataIndexes = normalizedColumns
    .map((_, index) => index)
    .filter(
      (index) =>
        !CLIENT_WORK_COLUMNS.some(
          (column) => normalizeColumnName(normalizedColumns[index]) === column.toLowerCase(),
        ),
    );

  return {
    columns: [
      ...dataIndexes.map((index) => normalizedColumns[index]),
      ...CLIENT_WORK_COLUMNS,
    ],
    rows: rows.map((row) => [
      ...dataIndexes.map((index) => normalizeCell(row?.[index])),
      ...CLIENT_WORK_COLUMNS.map((column) => {
        const index = workIndexes.get(column);
        return index === -1 ? '' : normalizeCell(row?.[index]);
      }),
    ]),
  };
};

const getCellValue = (columns, row, candidates) => {
  const normalizedCandidates = candidates.map((candidate) => candidate.toLowerCase());
  const index = columns.findIndex((column) =>
    normalizedCandidates.includes(normalizeColumnName(column)),
  );
  return index === -1 ? '' : normalizeCell(row?.[index]);
};

const getDatasetRowContext = (dataset, rowIndex) => {
  const normalized = addWorkColumnsAfterWebsite(dataset.columns || [], dataset.rows || []);
  const row = normalized.rows[rowIndex];
  if (!row) return null;

  const companyName = getCellValue(normalized.columns, row, [
    'Company Name',
    'Account Name',
  ]);
  const clientName =
    getCellValue(normalized.columns, row, ['Client Name', 'Full Name', 'MR Name']) ||
    companyName ||
    `Row ${rowIndex + 1}`;

  return {
    row,
    columns: normalized.columns,
    status: getCellValue(normalized.columns, row, ['Status']),
    clientName,
    companyName,
    clientEmail: getCellValue(normalized.columns, row, ['Email', 'Email 1', 'Email Address']),
    clientPhone: getCellValue(normalized.columns, row, [
      'Phone',
      'Phone Number',
      'Mobile',
      'Mobile 1',
    ]),
  };
};

const getRowAssignmentUserIds = (dataset, rowIndex) => [
  ...new Set(
    (dataset.rowAssignments || [])
      .filter((assignment) => Number(assignment.rowIndex) === Number(rowIndex))
      .map((assignment) => String(assignment.employee || ''))
      .filter((id) => mongoose.isValidObjectId(id)),
  ),
];

const meetingPopulate = (query) =>
  query
    .populate('employee', 'name email employeeId position')
    .populate('participantUserIds', 'name email employeeId position')
    .populate('dataset', 'name year communityKey')
    .populate('businessUnitId', 'name slug legacyCommunityKey')
    .populate('departmentId', 'name slug');

const getAccessibleOrganization = async (user) => {
  if (user.roleKey === 'super_admin') {
    const [businessUnits, departments] = await Promise.all([
      BusinessUnit.find({ status: 'active' }).sort({ name: 1 }).lean(),
      Department.find({ status: 'active' }).sort({ name: 1 }).lean(),
    ]);
    return { businessUnits, departments, assignments: [] };
  }
  const assignments = await UserAccessAssignment.find(activeAccessQuery(user._id))
    .select('businessUnitIds departmentId teamIds')
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
  return { businessUnits, departments, assignments };
};

const loadLinkedMeetingContext = async (req, datasetId, rowIndex) => {
  const dataset = await ClientDataset.findById(datasetId).populate(
    'businessUnitId',
    'name slug legacyCommunityKey',
  );
  if (!dataset) {
    const error = new Error('Client dataset not found');
    error.status = 404;
    throw error;
  }

  const rowContext = getDatasetRowContext(dataset, rowIndex);
  if (!rowContext) {
    const error = new Error('Client row not found');
    error.status = 404;
    throw error;
  }

  let businessUnit = dataset.businessUnitId || null;
  if (!businessUnit) {
    businessUnit = await BusinessUnit.findOne({
      legacyCommunityKey: dataset.communityKey,
      status: 'active',
    }).select('name slug legacyCommunityKey');
  }
  if (!businessUnit) {
    const error = new Error('Dataset Business Unit is not available');
    error.status = 409;
    throw error;
  }

  const assignmentUserIds = getRowAssignmentUserIds(dataset, rowIndex);
  const actorIsAssigned = assignmentUserIds.includes(String(req.user._id));
  const {
    businessUnits: actorBusinessUnits,
    assignments: actorAssignments = [],
  } = await getAccessibleOrganization(req.user);
  const actorBusinessUnitIds = new Set(actorBusinessUnits.map((unit) => String(unit._id)));
  const actorUnitDepartmentIds = new Set(
    actorAssignments
      .filter((assignment) =>
        (assignment.businessUnitIds || []).map(String).includes(String(businessUnit._id)),
      )
      .map((assignment) => String(assignment.departmentId || ''))
      .filter(Boolean),
  );
  const leadsViewPermission = getPermission(req.effectivePermissions || [], 'leads', 'view');
  const assignedOnly =
    ASSIGNED_SCOPES.has(req.permission?.scope) ||
    (!leadsViewPermission || ASSIGNED_SCOPES.has(leadsViewPermission.scope));

  if (
    req.user.roleKey !== 'super_admin' &&
    (!actorBusinessUnitIds.has(String(businessUnit._id)) || (assignedOnly && !actorIsAssigned))
  ) {
    const error = new Error('You cannot schedule a meeting for this client row');
    error.status = 403;
    throw error;
  }

  const [employees, memberships, unitDepartments] = await Promise.all([
    User.find({
      _id: { $in: assignmentUserIds },
      userType: 'employee',
      isDeleted: { $ne: true },
      accountStatus: 'active',
    })
      .select('name email employeeId position role team secondaryTeam')
      .sort({ name: 1 })
      .lean(),
    UserAccessAssignment.find({
      ...activeAccessQuery({ $in: assignmentUserIds }),
      businessUnitIds: businessUnit._id,
    })
      .select('userId departmentId businessUnitIds teamIds')
      .lean(),
    Department.find({
      status: 'active',
      businessUnitIds: businessUnit._id,
    })
      .select('name slug businessUnitIds')
      .sort({ name: 1 })
      .lean(),
  ]);

  const membershipMap = new Map();
  memberships.forEach((membership) => {
    const userId = String(membership.userId);
    const current = membershipMap.get(userId) || {
      departmentIds: [],
      businessUnitIds: [],
      teamIds: [],
    };
    if (membership.departmentId) {
      current.departmentIds = [
        ...new Set([...current.departmentIds, String(membership.departmentId)]),
      ];
    }
    current.businessUnitIds = [
      ...new Set([...current.businessUnitIds, ...(membership.businessUnitIds || []).map(String)]),
    ];
    current.teamIds = [
      ...new Set([...current.teamIds, ...(membership.teamIds || []).map(String)]),
    ];
    membershipMap.set(userId, current);
  });

  const activeUnitDepartmentIds = new Set(
    unitDepartments.map((department) => String(department._id)),
  );
  const enrichedAssignedEmployees = employees.map((employee) => {
    const organization = membershipMap.get(String(employee._id)) || {
      departmentIds: [],
      businessUnitIds: [],
      teamIds: [],
    };
    const schedulableDepartmentIds = organization.departmentIds.filter(
      (departmentId) =>
        activeUnitDepartmentIds.has(String(departmentId)) &&
        (req.user.roleKey === 'super_admin' || actorUnitDepartmentIds.has(String(departmentId))),
    );
    return {
      ...employee,
      ...organization,
      schedulableDepartmentIds,
      canSchedule: schedulableDepartmentIds.length > 0,
    };
  });

  const actorTeamIds = new Set(
    actorAssignments
      .filter((assignment) =>
        (assignment.businessUnitIds || []).map(String).includes(String(businessUnit._id)),
      )
      .flatMap((assignment) => assignment.teamIds || [])
      .map(String),
  );
  const actorTeamNames = new Set(
    [req.user.team, req.user.secondaryTeam]
      .map((teamName) => normalizeCell(teamName).toLowerCase())
      .filter(Boolean),
  );
  const sharesActorTeam = (employee) =>
    employee.teamIds.some((teamId) => actorTeamIds.has(String(teamId))) ||
    [employee.team, employee.secondaryTeam]
      .map((teamName) => normalizeCell(teamName).toLowerCase())
      .filter(Boolean)
      .some((teamName) => actorTeamNames.has(teamName));

  const scope = req.permission?.scope;
  const assignedEmployees =
    req.user.roleKey === 'super_admin'
      ? enrichedAssignedEmployees
      : enrichedAssignedEmployees.filter((employee) => {
          if (!employee.canSchedule) return false;
          if (ASSIGNED_SCOPES.has(scope)) {
            return String(employee._id) === String(req.user._id);
          }
          if (TEAM_SCOPES.has(scope)) return sharesActorTeam(employee);
          return true;
        });

  if (!assignedEmployees.length) {
    const error = new Error('This client row is outside your meeting access scope');
    error.status = 403;
    throw error;
  }

  const suggestedEmployee =
    assignedEmployees.find(
      (employee) => String(employee._id) === String(req.user._id) && employee.canSchedule,
    ) ||
    assignedEmployees.find((employee) => employee.canSchedule) ||
    null;
  const eligibleDepartmentIds = new Set(suggestedEmployee?.schedulableDepartmentIds || []);
  const eligibleDepartments = unitDepartments.filter((department) =>
    eligibleDepartmentIds.has(String(department._id)),
  );
  const officeModule = normalizeCell(dataset.officeModule).toLowerCase();
  const suggestedDepartment =
    eligibleDepartments.find(
      (department) =>
        normalizeCell(department.name).toLowerCase() === officeModule ||
        normalizeCell(department.slug).toLowerCase() === officeModule,
    ) ||
    eligibleDepartments.find((department) => department.slug === 'sales') ||
    eligibleDepartments[0] ||
    null;

  return {
    dataset,
    businessUnit,
    rowContext,
    assignmentUserIds,
    assignedEmployees,
    suggestedEmployee,
    suggestedDepartment,
    unitDepartments,
  };
};

const linkedContextPayload = (context, rowIndex) => ({
  dataset: {
    _id: context.dataset._id,
    name: context.dataset.name,
    year: context.dataset.year || '',
    communityKey: context.dataset.communityKey,
  },
  datasetId: context.dataset._id,
  datasetName: context.dataset.name,
  rowIndex,
  client: {
    name: context.rowContext.clientName,
    companyName: context.rowContext.companyName,
    email: context.rowContext.clientEmail,
    phone: context.rowContext.clientPhone,
  },
  clientName: context.rowContext.clientName,
  companyName: context.rowContext.companyName,
  status: context.rowContext.status,
  businessUnit: context.businessUnit,
  businessUnitId: context.businessUnit._id,
  department: context.suggestedDepartment,
  departmentId: context.suggestedDepartment?._id || null,
  assignedEmployees: context.assignedEmployees,
  suggestedEmployeeId: context.suggestedEmployee?._id || null,
  canSchedule:
    context.rowContext.status === 'Interested' &&
    Boolean(context.suggestedEmployee) &&
    Boolean(context.suggestedDepartment),
});

router.get('/context', requirePermission('meetings', 'create'), async (req, res, next) => {
  try {
    const datasetId = normalizeCell(req.query.datasetId);
    const rowIndex = Number(req.query.rowIndex);
    if (!mongoose.isValidObjectId(datasetId) || !Number.isInteger(rowIndex) || rowIndex < 0) {
      return res.status(400).json({ message: 'Select a valid client dataset row' });
    }

    const context = await loadLinkedMeetingContext(req, datasetId, rowIndex);
    return res.json(linkedContextPayload(context, rowIndex));
  } catch (error) {
    return next(error);
  }
});

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
        .select('businessUnitIds departmentId teamIds')
        .lean();
      const businessUnitIds = [
        ...new Set(
          assignments.flatMap((assignment) => assignment.businessUnitIds || []).map(String),
        ),
      ];
      const scope = req.permission?.scope;
      const ownMeetingClauses = [
        { employee: req.user._id },
        { participantUserIds: req.user._id },
      ];
      const ownMeetings = {
        $or: ownMeetingClauses,
      };
      const departmentClauses = assignments
        .filter(
          (assignment) => assignment.departmentId && assignment.businessUnitIds?.length,
        )
        .map((assignment) => ({
          departmentId: assignment.departmentId,
          businessUnitId: { $in: assignment.businessUnitIds },
        }));

      if (COMPANY_SCOPES.has(scope)) {
        query = {};
      } else if (BUSINESS_UNIT_SCOPES.has(scope)) {
        query = businessUnitIds.length
          ? { businessUnitId: { $in: businessUnitIds } }
          : { _id: null };
      } else if (DEPARTMENT_SCOPES.has(scope)) {
        query = departmentClauses.length ? { $or: departmentClauses } : { _id: null };
      } else if (TEAM_SCOPES.has(scope)) {
        const teamNames = [req.user.team, req.user.secondaryTeam]
          .map(normalizeCell)
          .filter(Boolean);
        const teamClauses = assignments
          .filter(
            (assignment) =>
              assignment.departmentId &&
              assignment.businessUnitIds?.length &&
              (assignment.teamIds?.length || teamNames.length),
          )
          .map((assignment) => {
            const teamFilters = [
              ...(assignment.teamIds?.length
                ? [{ teamIds: { $in: assignment.teamIds } }]
                : []),
              ...(teamNames.length ? [{ team: { $in: teamNames } }] : []),
            ];
            return {
              departmentId: assignment.departmentId,
              businessUnitId: { $in: assignment.businessUnitIds },
              ...(teamFilters.length === 1 ? teamFilters[0] : { $or: teamFilters }),
            };
          });
        query = { $or: [...ownMeetingClauses, ...teamClauses] };
      } else {
        query = ownMeetings;
      }
    }
    if (req.selectedCommunity) {
      const selectedCommunityQuery = { communityKey: req.selectedCommunity };
      query = Object.keys(query).length
        ? { $and: [query, selectedCommunityQuery] }
        : selectedCommunityQuery;
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
    const title = normalizeCell(req.body.meetingTitle);
    const meetingDate = normalizeCell(req.body.meetingDate);
    const meetingTime = normalizeCell(req.body.meetingTime);
    const datasetId = normalizeCell(req.body.datasetId);
    const hasLinkedRow =
      Boolean(datasetId) ||
      (req.body.rowIndex !== undefined &&
        req.body.rowIndex !== null &&
        normalizeCell(req.body.rowIndex) !== '');
    const linkedRowIndex = Number(req.body.rowIndex);

    if (!title || !isValidDateKey(meetingDate) || !isValidTimeKey(meetingTime))
      return res.status(400).json({ message: 'Meeting title, valid date and time are required' });
    if (meetingDate < getDateInTimeZone())
      return res.status(400).json({ message: 'Meeting date cannot be in the past' });

    if (
      hasLinkedRow &&
      (!mongoose.isValidObjectId(datasetId) ||
        !Number.isInteger(linkedRowIndex) ||
        linkedRowIndex < 0)
    )
      return res.status(400).json({ message: 'Select a valid client dataset row' });

    const linkedContext = hasLinkedRow
      ? await loadLinkedMeetingContext(req, datasetId, linkedRowIndex)
      : null;
    if (linkedContext && linkedContext.rowContext.status !== 'Interested')
      return res.status(409).json({
        message: 'A meeting can be scheduled only when the client status is Interested',
      });

    const businessUnitId = linkedContext
      ? String(linkedContext.businessUnit._id)
      : normalizeCell(req.body.businessUnitId);
    const departmentId =
      normalizeCell(req.body.departmentId) ||
      (linkedContext?.suggestedDepartment?._id
        ? String(linkedContext.suggestedDepartment._id)
        : '');
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
    let meetingTeamIds = [];
    if (req.user.roleKey !== 'super_admin') {
      const actorMeetingAccess = await UserAccessAssignment.find({
        ...activeAccessQuery(req.user._id),
        departmentId: department._id,
        businessUnitIds: businessUnit._id,
      })
        .select('teamIds')
        .lean();
      if (!actorMeetingAccess.length)
        return res.status(403).json({
          message:
            'You cannot schedule a meeting outside your assigned Department and Business Unit',
        });
      meetingTeamIds = [
        ...new Set(actorMeetingAccess.flatMap((access) => access.teamIds || []).map(String)),
      ];
    }

    let meetingEmployeeId = String(req.user._id);
    let assignedEmployee = null;
    if (linkedContext) {
      meetingEmployeeId =
        normalizeCell(req.body.employeeId) ||
        (linkedContext.suggestedEmployee?._id
          ? String(linkedContext.suggestedEmployee._id)
          : '');
      assignedEmployee = linkedContext.assignedEmployees.find(
        (employee) => String(employee._id) === meetingEmployeeId,
      );
      if (
        !mongoose.isValidObjectId(meetingEmployeeId) ||
        !linkedContext.assignmentUserIds.includes(meetingEmployeeId) ||
        !assignedEmployee
      )
        return res.status(400).json({
          message: 'Select an active employee assigned to this client row',
        });
      if (
        req.user.roleKey !== 'super_admin' &&
        ASSIGNED_SCOPES.has(req.permission?.scope) &&
        meetingEmployeeId !== String(req.user._id)
      )
        return res.status(403).json({
          message: 'You can schedule linked meetings only for your own assigned client data',
        });

      const employeeMeetingAccess = await UserAccessAssignment.find({
        ...activeAccessQuery(meetingEmployeeId),
        departmentId: department._id,
        businessUnitIds: businessUnit._id,
      })
        .select('teamIds')
        .lean();
      if (!employeeMeetingAccess.length)
        return res.status(400).json({
          message: 'The selected employee does not belong to this Department and Business Unit',
        });
      meetingTeamIds = [
        ...new Set(employeeMeetingAccess.flatMap((access) => access.teamIds || []).map(String)),
      ];
    }

    const participantIds = [
      ...new Set(
        (Array.isArray(req.body.participantUserIds) ? req.body.participantUserIds : [])
          .map(String)
          .filter(
            (id) =>
              mongoose.isValidObjectId(id) &&
              id !== meetingEmployeeId,
          ),
      ),
    ];
    let participantUsers = [];
    if (participantIds.length) {
      const [participantMemberships, activeParticipantUsers] = await Promise.all([
        UserAccessAssignment.find({
          ...activeAccessQuery({ $in: participantIds }),
          departmentId: department._id,
          businessUnitIds: businessUnit._id,
        }).distinct('userId'),
        User.find({
          _id: { $in: participantIds },
          accountStatus: 'active',
          isDeleted: { $ne: true },
        })
          .select('role')
          .lean(),
      ]);
      participantUsers = activeParticipantUsers;
      if (
        participantMemberships.length !== participantIds.length ||
        participantUsers.length !== participantIds.length
      )
        return res.status(400).json({
          message:
            'One or more participants do not belong to the selected Department and Business Unit',
        });
    }
    const attendeeIds = [...new Set([meetingEmployeeId, ...participantIds])];
    const conflict = await Meeting.exists({
      meetingDate,
      meetingTime,
      status: 'scheduled',
      $or: [
        { employee: { $in: attendeeIds } },
        { participantUserIds: { $in: attendeeIds } },
      ],
    });
    if (conflict)
      return res
        .status(409)
        .json({ message: 'One or more attendees already have a meeting at this time' });

    const actorTeamNames = [req.user.team, req.user.secondaryTeam]
      .map(normalizeCell)
      .filter(Boolean);
    const employeeTeamNames = [assignedEmployee?.team, assignedEmployee?.secondaryTeam]
      .map(normalizeCell)
      .filter(Boolean);
    const meetingTeam =
      employeeTeamNames.find((teamName) =>
        actorTeamNames.some(
          (actorTeamName) => actorTeamName.toLowerCase() === teamName.toLowerCase(),
        ),
      ) ||
      employeeTeamNames[0] ||
      actorTeamNames[0] ||
      '';

    const meeting = await Meeting.create({
      employee: meetingEmployeeId,
      participantUserIds: participantIds,
      businessUnitId: businessUnit._id,
      departmentId: department._id,
      communityKey: businessUnit.legacyCommunityKey,
      officeModule: department.name,
      team: meetingTeam,
      teamIds: meetingTeamIds,
      meetingTitle: title,
      meetingDate,
      meetingTime,
      durationMinutes: Math.min(480, Math.max(15, Number(req.body.durationMinutes) || 30)),
      meetingMode: ['Physical', 'Online', 'Phone'].includes(req.body.meetingMode)
        ? req.body.meetingMode
        : 'Online',
      platformOrLocation: normalizeCell(req.body.platformOrLocation),
      notes: normalizeCell(req.body.notes),
      ...(linkedContext
        ? {
            dataset: linkedContext.dataset._id,
            rowIndex: linkedRowIndex,
            datasetName: linkedContext.dataset.name,
            clientName: linkedContext.rowContext.clientName,
            companyName: linkedContext.rowContext.companyName,
          }
        : {}),
    });

    const actorName = req.user.name || req.user.email || 'Employee';
    const notificationRecipientIds = [
      ...new Set([
        ...participantIds,
        ...(meetingEmployeeId !== String(req.user._id) ? [meetingEmployeeId] : []),
      ]),
    ];
    const recipientRoleMap = new Map(
      participantUsers.map((participant) => [String(participant._id), participant.role]),
    );
    if (meetingEmployeeId !== String(req.user._id)) {
      recipientRoleMap.set(meetingEmployeeId, assignedEmployee?.role || 'employee');
    }
    await Promise.all(
      notificationRecipientIds.map((recipientId) =>
        createNotification({
          communityKey: businessUnit.legacyCommunityKey,
          recipientRole:
            recipientRoleMap.get(recipientId) === 'admin' ? 'admin' : 'employee',
          recipientUser: recipientId,
          actorUser: req.user._id,
          actorName,
          actorRole: req.user.role,
          type: 'meeting_scheduled',
          title: `${actorName} scheduled a meeting`,
          message: `${title} on ${meetingDate} at ${meetingTime}.`,
          link: `/dashboard/meetings?meetingId=${encodeURIComponent(String(meeting._id))}`,
          meta: {
            meetingId: meeting._id,
            departmentId: department._id,
            businessUnitId: businessUnit._id,
            ...(linkedContext
              ? { datasetId: linkedContext.dataset._id, rowIndex: linkedRowIndex }
              : {}),
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
