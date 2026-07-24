const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const XLSX = require('xlsx');
const ClientDataset = require('../models/ClientDataset');
const User = require('../models/User');
const BusinessUnit = require('../models/BusinessUnit');
const UserAccessAssignment = require('../models/UserAccessAssignment');
const authMiddleware = require('../middleware/authMiddleware');
const { createNotification } = require('../utils/notifications');
const { loadAuthorization } = require('../middleware/authorization');
const { getPermission } = require('../services/accessControlService');

const router = express.Router();
router.use(authMiddleware, loadAuthorization);
const CLIENT_WORK_COLUMNS = ['Status', 'Remark', 'Employee'];
const SALES_TABLE_FORMATS = {
  marketing: [
    'Sr. No.',
    'Company Name',
    'Client Name',
    'City',
    'Designation / Department',
    'Mobile 1',
    'Mobile 2',
    'Email 1',
    'Email 2',
    'Website',
  ],
  live: [
    'Date',
    'MR Name',
    'Full Name',
    'Email',
    'Phone Number',
    'City',
    'Targeted State',
    'Your Requirement',
    'Source',
    'Product',
  ],
};
const CLIENT_STATUS_OPTIONS = [
  'Pending',
  'Contacted',
  'Follow Up',
  'Interested',
  'Not Interested',
  'Converted',
  'Not Reachable',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowedExtensions = /\.(xlsx|xls)$/i;
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream',
    ];

    if (allowedExtensions.test(file.originalname) || allowedMimeTypes.includes(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new Error('Only Excel files are allowed'));
  },
});

const requireAdmin = async (req, res, next) => {
  const action = req.path.includes('/upload')
    ? 'import'
    : req.method === 'GET'
      ? 'view'
      : req.method === 'POST'
        ? 'create'
        : req.method === 'DELETE'
          ? 'delete'
          : req.path.includes('assign')
            ? 'assign'
            : 'update';
  const permission = getPermission(req.effectivePermissions, 'leads', action);
  if (!permission)
    return res
      .status(403)
      .json({ message: `Access denied: Sales Data ${action} permission is required` });
  req.datasetPermission = permission;
  if (req.user.roleKey !== 'super_admin') {
    const now = new Date();
    const assignments = await UserAccessAssignment.find({
      userId: req.user.id,
      status: 'active',
      startDate: { $lte: now },
      $or: [{ endDate: null }, { endDate: { $gte: now } }],
    })
      .populate('roleId', 'permissions')
      .lean();
    const businessUnitIds = [
      ...new Set(
        assignments
          .filter((assignment) =>
            assignment.roleId?.permissions?.some(
              (item) => item.resource === 'leads' && item.actions?.includes(action),
            ),
          )
          .flatMap((assignment) => (assignment.businessUnitIds || []).map(String)),
      ),
    ];
    if (businessUnitIds.length) {
      const units = await BusinessUnit.find({ _id: { $in: businessUnitIds }, status: 'active' })
        .select('legacyCommunityKey')
        .lean();
      req.datasetCommunityKeys = units.map((unit) => unit.legacyCommunityKey).filter(Boolean);
    }
  }
  return next();
};

const isAssignedScope = (scope) => ['assigned', 'ASSIGNED', 'self', 'OWN'].includes(scope);

const communityFilter = (req) => ({
  communityKey: {
    $in: req.selectedCommunity
      ? [req.selectedCommunity]
      : req.user.roleKey === 'super_admin'
        ? ['live', 'marketing', 'exhibition']
        : req.datasetCommunityKeys || req.user.communities,
  },
});

const requestedCommunity = (req) =>
  String(req.body.communityKey || req.selectedCommunity || '')
    .trim()
    .toLowerCase();

const resolveRequestedBusinessUnit = async (req) => {
  const businessUnitId = normalizeCell(req.body.businessUnitId);
  const communityKey = requestedCommunity(req);
  if (businessUnitId && !mongoose.isValidObjectId(businessUnitId)) return null;
  const query = businessUnitId ? { _id: businessUnitId } : { legacyCommunityKey: communityKey };
  const businessUnit = await BusinessUnit.findOne({ ...query, status: 'active' });
  if (!businessUnit) return null;
  if (
    req.datasetCommunityKeys &&
    !req.datasetCommunityKeys.includes(businessUnit.legacyCommunityKey)
  )
    return false;
  if (
    req.user.roleKey !== 'super_admin' &&
    !(req.user.communities || []).includes(businessUnit.legacyCommunityKey)
  )
    return false;
  return businessUnit;
};

const employeeHasBusinessUnit = async (employee, businessUnit) => {
  if (!businessUnit) return false;
  const assignment = await UserAccessAssignment.exists({
    userId: employee._id,
    businessUnitIds: businessUnit._id,
    status: 'active',
    startDate: { $lte: new Date() },
    $or: [{ endDate: null }, { endDate: { $gte: new Date() } }],
  });
  return (
    Boolean(assignment) || (employee.communities || []).includes(businessUnit.legacyCommunityKey)
  );
};

const normalizeCell = (cell) => {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return cell.toISOString();
  return String(cell).trim();
};

const normalizeColumnName = (column) => normalizeCell(column).toLowerCase();
const normalizeHeaderKey = (column) => normalizeColumnName(column).replace(/[^a-z0-9]/g, '');

const addWorkColumnsAfterWebsite = (columns, rows) => {
  const normalizedColumns = columns.map(
    (column, index) => normalizeCell(column) || `Column ${index + 1}`,
  );
  const workIndexes = new Map(
    CLIENT_WORK_COLUMNS.map((column) => [
      column,
      normalizedColumns.findIndex((item) => normalizeColumnName(item) === column.toLowerCase()),
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
    columns: [...dataIndexes.map((index) => normalizedColumns[index]), ...CLIENT_WORK_COLUMNS],
    rows: rows.map((row) => [
      ...dataIndexes.map((index) => normalizeCell(row[index])),
      ...CLIENT_WORK_COLUMNS.map((column) =>
        workIndexes.get(column) === -1 ? '' : normalizeCell(row[workIndexes.get(column)]),
      ),
    ]),
  };
};

const applyBusinessUnitTableFormat = (communityKey, columns, rows) => {
  const template = SALES_TABLE_FORMATS[communityKey];
  if (!template) return { ...addWorkColumnsAfterWebsite(columns, rows), format: 'exhibition' };
  const sourceIndex = new Map(columns.map((column, index) => [normalizeHeaderKey(column), index]));
  const missing = template.filter(
    (column) =>
      normalizeHeaderKey(column) !== 'srno' && !sourceIndex.has(normalizeHeaderKey(column)),
  );
  if (missing.length)
    return {
      error: `${communityKey === 'marketing' ? 'Marketing' : 'Live'} sheet is missing columns: ${missing.join(', ')}`,
    };
  const formattedRows = rows.map((row, rowIndex) =>
    template.map((column) => {
      const index = sourceIndex.get(normalizeHeaderKey(column));
      return index === undefined && normalizeHeaderKey(column) === 'srno'
        ? String(rowIndex + 1)
        : normalizeCell(row[index]);
    }),
  );
  return { ...addWorkColumnsAfterWebsite(template, formattedRows), format: communityKey };
};

const getColumnIndex = (columns, columnName) =>
  columns.findIndex((column) => normalizeColumnName(column) === columnName.toLowerCase());

const getCellValue = (columns, row, columnNames) => {
  const normalizedNames = columnNames.map((columnName) => columnName.toLowerCase());
  const index = columns.findIndex((column) =>
    normalizedNames.includes(normalizeColumnName(column)),
  );

  return index === -1 ? '' : normalizeCell(row[index]);
};

const getDatasetSalesSummary = (dataset) => {
  const normalizedData = addWorkColumnsAfterWebsite(dataset.columns || [], dataset.rows || []);
  const statusIndex = getColumnIndex(normalizedData.columns, 'Status');
  const employeeIndex = getColumnIndex(normalizedData.columns, 'Employee');
  const statusCounts = CLIENT_STATUS_OPTIONS.reduce(
    (counts, status) => ({
      ...counts,
      [status]: 0,
    }),
    {},
  );

  normalizedData.rows.forEach((row) => {
    const status = statusIndex === -1 ? '' : normalizeCell(row[statusIndex]);
    if (statusCounts[status] !== undefined) statusCounts[status] += 1;
  });

  const assignedRows = normalizedData.rows.filter(
    (row, rowIndex) =>
      normalizeAssignments(dataset.rowAssignments || []).some(
        (assignment) => Number(assignment.rowIndex) === rowIndex,
      ) ||
      (employeeIndex !== -1 && normalizeCell(row[employeeIndex])),
  ).length;
  const totalRows = normalizedData.rows.length;
  const convertedRows = statusCounts.Converted || 0;
  const interestedRows = statusCounts.Interested || 0;
  const followUpRows = statusCounts['Follow Up'] || 0;
  const contactedRows = statusCounts.Contacted || 0;
  const lostRows = (statusCounts['Not Interested'] || 0) + (statusCounts['Not Reachable'] || 0);
  const untouchedRows =
    totalRows - Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

  return {
    totalRows,
    assignedRows,
    unassignedRows: Math.max(totalRows - assignedRows, 0),
    openRows: Math.max(totalRows - convertedRows - lostRows, 0),
    contactedRows,
    followUpRows,
    interestedRows,
    convertedRows,
    lostRows,
    untouchedRows,
    conversionRate: totalRows ? Math.round((convertedRows / totalRows) * 100) : 0,
    statusCounts,
  };
};

const getDatasetPreview = (dataset) => {
  const normalizedData = addWorkColumnsAfterWebsite(dataset.columns || [], dataset.rows || []);
  const firstRow = normalizedData.rows[0] || [];

  return {
    accountName: getCellValue(normalizedData.columns, firstRow, [
      'Account Name',
      'Client Name',
      'Company Name',
    ]),
    phone: getCellValue(normalizedData.columns, firstRow, ['Phone', 'Mobile', 'Contact Number']),
    website: getCellValue(normalizedData.columns, firstRow, ['Website', 'URL']),
    billingCity: getCellValue(normalizedData.columns, firstRow, ['Billing City', 'City']),
    billingState: getCellValue(normalizedData.columns, firstRow, [
      'Billing State/Province',
      'State',
      'State/Province',
    ]),
  };
};

const getDatasetListItem = (dataset) => ({
  _id: dataset._id,
  businessUnitId: dataset.businessUnitId?._id || dataset.businessUnitId || null,
  businessUnitName: dataset.businessUnitId?.name || '',
  communityKey: dataset.communityKey,
  tableFormat: dataset.tableFormat || dataset.communityKey,
  name: dataset.name,
  year: dataset.year,
  label: dataset.label || 'Prospect List',
  priority: dataset.priority || 'Medium',
  source: dataset.source || 'Excel Import',
  ownerAlias: dataset.ownerAlias || 'Admin',
  salesStage: dataset.salesStage || 'Prospecting',
  originalFileName: dataset.originalFileName,
  rowCount: dataset.rowCount,
  uploadedBy: dataset.uploadedBy,
  createdAt: dataset.createdAt,
  updatedAt: dataset.updatedAt,
  summary: getDatasetSalesSummary(dataset),
  preview: getDatasetPreview(dataset),
});

const getRowClientLabel = (columns, row, rowIndex) =>
  getCellValue(columns, row, ['Client Name', 'Company Name', 'Website']) || `Row ${rowIndex + 1}`;

const getUserLabel = async (userId) => {
  const user = await User.findById(userId).select('name email');
  return user?.name || user?.email || 'User';
};

const prepareDatasetResponse = (dataset, includeLogs = false) => {
  const datasetObject = dataset.toObject();
  const normalizedData = addWorkColumnsAfterWebsite(
    datasetObject.columns || [],
    datasetObject.rows || [],
  );
  const rowLogs = includeLogs ? datasetObject.rowLogs || [] : undefined;
  const rowAssignments = includeLogs ? datasetObject.rowAssignments || [] : undefined;

  return {
    ...datasetObject,
    businessUnitId: datasetObject.businessUnitId?._id || datasetObject.businessUnitId || null,
    businessUnitName: datasetObject.businessUnitId?.name || '',
    tableFormat: datasetObject.tableFormat || datasetObject.communityKey,
    columns: normalizedData.columns,
    rows: normalizedData.rows,
    rowLogs,
    rowAssignments,
  };
};

const normalizeRowLogs = (rowLogs = []) =>
  rowLogs.map((rowLog) => ({
    rowIndex: Number(rowLog.rowIndex),
    entries: [...(rowLog.entries || [])],
  }));

const findRowLog = (rowLogs, rowIndex) =>
  rowLogs.find((rowLog) => Number(rowLog.rowIndex) === Number(rowIndex));

const upsertRowLogEntry = (rowLogs = [], rowIndex, entry) => {
  const normalizedRowLogs = normalizeRowLogs(rowLogs);
  const existingRowLog = findRowLog(normalizedRowLogs, rowIndex);

  if (existingRowLog) {
    existingRowLog.entries = [...(existingRowLog.entries || []), entry];
    return {
      rowLogs: normalizedRowLogs,
      rowLog: existingRowLog,
    };
  }

  const rowLog = {
    rowIndex,
    entries: [entry],
  };

  return {
    rowLogs: [...normalizedRowLogs, rowLog],
    rowLog,
  };
};

const normalizeRowIndexes = (rowIndexes) => {
  if (!Array.isArray(rowIndexes)) return [];

  return [
    ...new Set(
      rowIndexes
        .map((rowIndex) => Number(rowIndex))
        .filter((rowIndex) => Number.isInteger(rowIndex) && rowIndex >= 0),
    ),
  ];
};

const normalizeAssignments = (rowAssignments = []) =>
  rowAssignments.map((assignment) => ({
    rowIndex: Number(assignment.rowIndex),
    employee: assignment.employee,
    employeeName: assignment.employeeName || '',
    assignedBy: assignment.assignedBy,
    assignedAt: assignment.assignedAt || new Date(),
  }));

const getAssignmentsByRow = (rowAssignments = []) => {
  const assignmentMap = new Map();
  normalizeAssignments(rowAssignments).forEach((assignment) => {
    const rowIndex = Number(assignment.rowIndex);
    assignmentMap.set(rowIndex, [...(assignmentMap.get(rowIndex) || []), assignment]);
  });
  return assignmentMap;
};

const getEmployeeDatasetResponse = (dataset, employeeId) => {
  const datasetObject = dataset.toObject();
  const normalizedData = addWorkColumnsAfterWebsite(
    datasetObject.columns || [],
    datasetObject.rows || [],
  );
  const employeeAssignments = normalizeAssignments(datasetObject.rowAssignments || []).filter(
    (assignment) => String(assignment.employee) === String(employeeId),
  );
  const assignedRowIndexes = employeeAssignments.map((assignment) => Number(assignment.rowIndex));
  const assignedRows = assignedRowIndexes
    .map((rowIndex) => normalizedData.rows[rowIndex])
    .filter(Boolean);

  return {
    _id: datasetObject._id,
    businessUnitId: datasetObject.businessUnitId?._id || datasetObject.businessUnitId || null,
    businessUnitName: datasetObject.businessUnitId?.name || '',
    tableFormat: datasetObject.tableFormat || datasetObject.communityKey,
    name: datasetObject.name,
    year: datasetObject.year,
    originalFileName: datasetObject.originalFileName,
    columns: normalizedData.columns,
    rows: assignedRows,
    originalRowIndexes: assignedRowIndexes,
    rowCount: assignedRows.length,
    createdAt: datasetObject.createdAt,
    updatedAt: datasetObject.updatedAt,
  };
};

router.get('/options', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const businessUnitQuery =
      req.user.roleKey === 'super_admin'
        ? { status: 'active' }
        : {
            status: 'active',
            legacyCommunityKey: { $in: req.datasetCommunityKeys || req.user.communities || [] },
          };
    const businessUnits = await BusinessUnit.find(businessUnitQuery)
      .select('name slug legacyCommunityKey')
      .sort({ name: 1 })
      .lean();
    const employees = await User.find({
      $or: [{ userType: 'employee' }, { role: 'employee' }],
      isDeleted: { $ne: true },
      accountStatus: 'active',
    })
      .select('name email employeeId communities')
      .sort({ name: 1 })
      .lean();
    const assignments = await UserAccessAssignment.find({
      userId: { $in: employees.map((employee) => employee._id) },
      status: 'active',
      startDate: { $lte: new Date() },
      $or: [{ endDate: null }, { endDate: { $gte: new Date() } }],
    })
      .select('userId businessUnitIds')
      .lean();
    const unitMap = new Map();
    assignments.forEach((assignment) => {
      const userId = String(assignment.userId);
      unitMap.set(userId, [
        ...new Set([...(unitMap.get(userId) || []), ...assignment.businessUnitIds.map(String)]),
      ]);
    });
    const canAssign = Boolean(getPermission(req.effectivePermissions, 'leads', 'assign'));
    return res.json({
      businessUnits,
      employees: canAssign
        ? employees.map((employee) => ({
            _id: employee._id,
            name: employee.name,
            email: employee.email,
            employeeId: employee.employeeId || '',
            businessUnitIds:
              unitMap.get(String(employee._id)) ||
              businessUnits
                .filter((unit) => (employee.communities || []).includes(unit.legacyCommunityKey))
                .map((unit) => String(unit._id)),
          }))
        : [],
      actions:
        req.effectivePermissions.find((permission) => permission.resource === 'leads')?.actions ||
        [],
    });
  } catch (error) {
    console.error('Error fetching client dataset options:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

router.get('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const query = {
      ...communityFilter(req),
      ...(isAssignedScope(req.datasetPermission.scope)
        ? { 'rowAssignments.employee': req.user.id }
        : {}),
    };
    const datasets = await ClientDataset.find(query)
      .populate('businessUnitId', 'name slug legacyCommunityKey')
      .sort({ createdAt: -1 });
    if (isAssignedScope(req.datasetPermission.scope)) {
      return res.json(
        datasets.map((dataset) => {
          const assigned = getEmployeeDatasetResponse(dataset, req.user.id);
          return {
            _id: assigned._id,
            businessUnitId: assigned.businessUnitId,
            businessUnitName: assigned.businessUnitName,
            communityKey: dataset.communityKey,
            name: assigned.name,
            year: assigned.year,
            originalFileName: assigned.originalFileName,
            rowCount: assigned.rowCount,
            createdAt: assigned.createdAt,
            updatedAt: assigned.updatedAt,
          };
        }),
      );
    }
    return res.json(datasets.map(getDatasetListItem));
  } catch (error) {
    console.error('Error fetching client datasets:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/assigned/me', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ message: 'Access denied: Employees only' });
    }

    const datasets = await ClientDataset.find({
      'rowAssignments.employee': req.user.id,
      ...communityFilter(req),
    })
      .select('-rowLogs')
      .populate('businessUnitId', 'name slug legacyCommunityKey')
      .sort({ updatedAt: -1 });

    const assignedDatasets = datasets.map((dataset) => {
      const response = getEmployeeDatasetResponse(dataset, req.user.id);

      return {
        _id: response._id,
        businessUnitId: response.businessUnitId,
        businessUnitName: response.businessUnitName,
        name: response.name,
        year: response.year,
        originalFileName: response.originalFileName,
        rowCount: response.rowCount,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
      };
    });

    return res.json(assignedDatasets);
  } catch (error) {
    console.error('Error fetching employee assigned datasets:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const viewPermission = getPermission(req.effectivePermissions, 'leads', 'view');
    if (viewPermission && req.user.roleKey !== 'super_admin') {
      const now = new Date();
      const assignments = await UserAccessAssignment.find({
        userId: req.user.id,
        status: 'active',
        startDate: { $lte: now },
        $or: [{ endDate: null }, { endDate: { $gte: now } }],
      })
        .populate('roleId', 'permissions')
        .lean();
      const businessUnitIds = [
        ...new Set(
          assignments
            .filter((assignment) =>
              assignment.roleId?.permissions?.some(
                (item) => item.resource === 'leads' && item.actions?.includes('view'),
              ),
            )
            .flatMap((assignment) => (assignment.businessUnitIds || []).map(String)),
        ),
      ];
      if (businessUnitIds.length) {
        const units = await BusinessUnit.find({ _id: { $in: businessUnitIds }, status: 'active' })
          .select('legacyCommunityKey')
          .lean();
        req.datasetCommunityKeys = units.map((unit) => unit.legacyCommunityKey).filter(Boolean);
      }
    }
    const dataset = await ClientDataset.findOne({ _id: req.params.id, ...communityFilter(req) })
      .populate('businessUnitId', 'name slug legacyCommunityKey')
      .populate('rowLogs.entries.changedBy', 'name email employeeId');

    if (!dataset) {
      return res.status(404).json({ message: 'Client dataset not found' });
    }

    if (!viewPermission || isAssignedScope(viewPermission.scope)) {
      const assignedDataset = getEmployeeDatasetResponse(dataset, req.user.id);

      if (assignedDataset.rows.length === 0) {
        return res.status(403).json({ message: 'No assigned data found in this dataset' });
      }

      return res.json(assignedDataset);
    }

    const includeLogs = Boolean(
      getPermission(req.effectivePermissions, 'leads', 'update') ||
      getPermission(req.effectivePermissions, 'leads', 'assign'),
    );
    return res.json(prepareDatasetResponse(dataset, includeLogs));
  } catch (error) {
    console.error('Error fetching client dataset:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id/rows/:rowIndex/status', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const rowIndex = Number(req.params.rowIndex);
    const { status = '', remark = '' } = req.body;

    if (!Number.isInteger(rowIndex) || rowIndex < 0) {
      return res.status(400).json({ message: 'Invalid row index' });
    }

    if (status && !CLIENT_STATUS_OPTIONS.includes(status)) {
      return res.status(400).json({ message: 'Invalid status selected' });
    }

    const dataset = await ClientDataset.findOne({ _id: req.params.id, ...communityFilter(req) });

    if (!dataset) {
      return res.status(404).json({ message: 'Client dataset not found' });
    }

    const { columns, rows } = addWorkColumnsAfterWebsite(dataset.columns || [], dataset.rows || []);

    if (rowIndex >= rows.length) {
      return res.status(404).json({ message: 'Client row not found' });
    }

    if (isAssignedScope(req.datasetPermission.scope)) {
      const assignmentMap = getAssignmentsByRow(dataset.rowAssignments || []);
      const rowAssignments = assignmentMap.get(rowIndex) || [];

      if (
        !rowAssignments.some((assignment) => String(assignment.employee) === String(req.user.id))
      ) {
        return res.status(403).json({ message: 'You can update only your assigned data' });
      }
    }

    const statusIndex = getColumnIndex(columns, 'Status');
    const remarkIndex = getColumnIndex(columns, 'Remark');
    const updatedRow = [...rows[rowIndex]];
    const previousStatus = normalizeCell(updatedRow[statusIndex]);
    const previousRemark = normalizeCell(updatedRow[remarkIndex]);
    const currentStatus = normalizeCell(status);
    const currentRemark = normalizeCell(remark);
    const statusChanged = previousStatus !== currentStatus;
    const remarkChanged = previousRemark !== currentRemark;

    updatedRow[statusIndex] = currentStatus;
    updatedRow[remarkIndex] = currentRemark;
    rows[rowIndex] = updatedRow;

    dataset.columns = columns;
    dataset.rows = rows;

    let updatedRowLog;
    let actorName = '';
    if (statusChanged || remarkChanged) {
      actorName = await getUserLabel(req.user.id);
      const nextLogEntry = {
        changedBy: req.user.id,
        changedByName: actorName,
        changedByRole: req.user.role,
        statusChanged,
        remarkChanged,
        previousStatus,
        currentStatus,
        previousRemark,
        currentRemark,
        changedAt: new Date(),
      };
      const nextLogState = upsertRowLogEntry(dataset.rowLogs || [], rowIndex, nextLogEntry);

      updatedRowLog = nextLogState.rowLog;
      dataset.rowLogs = nextLogState.rowLogs;
      dataset.markModified('rowLogs');
    } else {
      updatedRowLog = findRowLog(dataset.rowLogs || [], rowIndex);
    }

    dataset.markModified('columns');
    dataset.markModified('rows');
    await dataset.save();

    if ((statusChanged || remarkChanged) && isAssignedScope(req.datasetPermission.scope)) {
      actorName = actorName || (await getUserLabel(req.user.id));
      const clientLabel = getRowClientLabel(columns, updatedRow, rowIndex);
      const changes = [
        statusChanged ? `status: ${previousStatus || 'Empty'} to ${currentStatus || 'Empty'}` : '',
        remarkChanged ? 'remark updated' : '',
      ]
        .filter(Boolean)
        .join(', ');

      await createNotification({
        recipientRole: 'admin',
        actorUser: req.user.id,
        actorName,
        actorRole: req.user.role,
        type: 'client_row_update',
        title: `${actorName} updated client data`,
        message: `${clientLabel} in ${dataset.name}: ${changes}`,
        link: `/dashboard/clients/${dataset._id}`,
        meta: {
          datasetId: dataset._id,
          rowIndex,
          statusChanged,
          remarkChanged,
          previousStatus,
          currentStatus,
          previousRemark,
          currentRemark,
        },
      });
    }

    const responsePayload = {
      message: 'Client status updated successfully',
      columns,
      rowIndex,
      row: updatedRow,
    };

    if (!isAssignedScope(req.datasetPermission.scope)) {
      responsePayload.rowLog = updatedRowLog || { rowIndex, entries: [] };
    }

    return res.json(responsePayload);
  } catch (error) {
    console.error('Error updating client status:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

router.patch('/:id/assign', authMiddleware, requireAdmin, async (req, res) => {
  try {
    let rowIndexes = normalizeRowIndexes(req.body.rowIndexes);
    const employeeIds = [
      ...new Set(
        [...(Array.isArray(req.body.employeeIds) ? req.body.employeeIds : []), req.body.employeeId]
          .map(normalizeCell)
          .filter(Boolean),
      ),
    ];
    const assignmentMode = normalizeCell(req.body.assignmentMode).toLowerCase() || 'selected';
    const allowedModes = ['selected', 'full', 'half', 'limited'];
    if (!allowedModes.includes(assignmentMode))
      return res.status(400).json({ message: 'Select a valid assignment mode' });
    if (
      !employeeIds.length ||
      employeeIds.some((employeeId) => !mongoose.isValidObjectId(employeeId))
    ) {
      return res.status(400).json({ message: 'Select at least one valid employee' });
    }

    const employees = await User.find({
      _id: { $in: employeeIds },
      $or: [{ userType: 'employee' }, { role: 'employee' }],
      isDeleted: { $ne: true },
      accountStatus: 'active',
    }).select('name email communities');
    if (employees.length !== employeeIds.length) {
      return res.status(404).json({ message: 'One or more selected employees were not found' });
    }

    const dataset = await ClientDataset.findOne({ _id: req.params.id, ...communityFilter(req) });
    if (!dataset) {
      return res.status(404).json({ message: 'Client dataset not found' });
    }
    const businessUnit = dataset.businessUnitId
      ? await BusinessUnit.findById(dataset.businessUnitId)
      : await BusinessUnit.findOne({ legacyCommunityKey: dataset.communityKey, status: 'active' });
    const unitAccess = await Promise.all(
      employees.map((employee) => employeeHasBusinessUnit(employee, businessUnit)),
    );
    const unauthorizedEmployees = employees.filter((_, index) => !unitAccess[index]);
    if (unauthorizedEmployees.length) {
      return res.status(403).json({
        message: `${unauthorizedEmployees.map((employee) => employee.name || employee.email).join(', ')} cannot access this dataset Business Unit`,
      });
    }

    const { columns, rows } = addWorkColumnsAfterWebsite(dataset.columns || [], dataset.rows || []);
    const employeeIndex = getColumnIndex(columns, 'Employee');
    const currentAssignments = normalizeAssignments(dataset.rowAssignments || []);
    const availableRows = rows
      .map((_, rowIndex) => rowIndex)
      .filter((rowIndex) =>
        employees.some(
          (employee) =>
            !currentAssignments.some(
              (assignment) =>
                Number(assignment.rowIndex) === rowIndex &&
                String(assignment.employee) === String(employee._id),
            ),
        ),
      );

    if (assignmentMode === 'full') rowIndexes = availableRows;
    if (assignmentMode === 'half')
      rowIndexes = availableRows.slice(0, Math.ceil(availableRows.length / 2));
    if (assignmentMode === 'limited') {
      const limit = Number(req.body.limit);
      if (!Number.isInteger(limit) || limit < 1)
        return res.status(400).json({ message: 'Enter a valid record limit' });
      if (limit > availableRows.length)
        return res
          .status(400)
          .json({ message: `Only ${availableRows.length} unassigned records are available` });
      rowIndexes = availableRows.slice(0, limit);
    }
    if (rowIndexes.length === 0) {
      return res.status(400).json({
        message:
          assignmentMode === 'selected'
            ? 'Select at least one row to assign'
            : 'No unassigned records are available',
      });
    }
    const invalidRows = rowIndexes.filter((rowIndex) => rowIndex >= rows.length);

    if (invalidRows.length) {
      return res.status(400).json({
        message: `Invalid row numbers: ${invalidRows.map((rowIndex) => rowIndex + 1).join(', ')}`,
      });
    }

    const assignedAt = new Date();
    const nextAssignments = [...currentAssignments];
    const assignmentsByEmployee = new Map(employees.map((employee) => [String(employee._id), []]));

    rowIndexes.forEach((rowIndex) => {
      employees.forEach((employee) => {
        const alreadyAssigned = nextAssignments.some(
          (assignment) =>
            Number(assignment.rowIndex) === rowIndex &&
            String(assignment.employee) === String(employee._id),
        );
        if (alreadyAssigned) return;
        const employeeLabel = employee.name || employee.email || 'Employee';
        nextAssignments.push({
          rowIndex,
          employee: employee._id,
          employeeName: employeeLabel,
          assignedBy: req.user.id,
          assignedAt,
        });
        assignmentsByEmployee.get(String(employee._id)).push(rowIndex);
      });
    });

    const assignedCount = Array.from(assignmentsByEmployee.values()).reduce(
      (total, indexes) => total + indexes.length,
      0,
    );
    if (!assignedCount)
      return res
        .status(409)
        .json({ message: 'Selected data is already assigned to the selected employees' });
    const nextAssignmentMap = getAssignmentsByRow(nextAssignments);
    rowIndexes.forEach((rowIndex) => {
      rows[rowIndex][employeeIndex] = (nextAssignmentMap.get(rowIndex) || [])
        .map((assignment) => assignment.employeeName)
        .filter(Boolean)
        .join(', ');
    });

    dataset.columns = columns;
    dataset.rows = rows;
    dataset.rowAssignments = nextAssignments;
    dataset.markModified('columns');
    dataset.markModified('rows');
    dataset.markModified('rowAssignments');
    await dataset.save();

    const actorName = await getUserLabel(req.user.id);
    await Promise.all(
      employees.map((employee) => {
        const assignedRows = assignmentsByEmployee.get(String(employee._id));
        if (!assignedRows.length) return null;
        return createNotification({
          recipientRole: 'employee',
          recipientUser: employee._id,
          actorUser: req.user.id,
          actorName,
          actorRole: req.user.role,
          type: 'client_assignment',
          title: 'New client data assigned',
          message: `${assignedRows.length} row${assignedRows.length > 1 ? 's' : ''} assigned to you in ${dataset.name}.`,
          link: `/employee-dashboard/datasets/${dataset._id}`,
          meta: { datasetId: dataset._id, rowIndexes: assignedRows, employeeId: employee._id },
        });
      }),
    );

    return res.json({
      message: `${assignedCount} assignment${assignedCount === 1 ? '' : 's'} added across ${rowIndexes.length} row${rowIndexes.length === 1 ? '' : 's'} for ${employees.length} employee${employees.length === 1 ? '' : 's'}`,
      assignmentMode,
      assignedCount,
      employeeCount: employees.length,
      columns,
      rows,
      rowAssignments: nextAssignments,
    });
  } catch (error) {
    console.error('Error assigning client dataset rows:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

router.patch('/:id/unassign', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const rowIndexes = normalizeRowIndexes(req.body.rowIndexes);

    if (rowIndexes.length === 0) {
      return res.status(400).json({ message: 'Select at least one row to unassign' });
    }

    const dataset = await ClientDataset.findOne({ _id: req.params.id, ...communityFilter(req) });
    if (!dataset) {
      return res.status(404).json({ message: 'Client dataset not found' });
    }

    const { columns, rows } = addWorkColumnsAfterWebsite(dataset.columns || [], dataset.rows || []);
    const employeeIndex = getColumnIndex(columns, 'Employee');
    const invalidRows = rowIndexes.filter((rowIndex) => rowIndex >= rows.length);

    if (invalidRows.length) {
      return res.status(400).json({
        message: `Invalid row numbers: ${invalidRows.map((rowIndex) => rowIndex + 1).join(', ')}`,
      });
    }

    const removedAssignments = normalizeAssignments(dataset.rowAssignments || []).filter(
      (assignment) => rowIndexes.includes(Number(assignment.rowIndex)),
    );

    rowIndexes.forEach((rowIndex) => {
      rows[rowIndex][employeeIndex] = '';
    });

    const nextAssignments = normalizeAssignments(dataset.rowAssignments || []).filter(
      (assignment) => !rowIndexes.includes(Number(assignment.rowIndex)),
    );

    dataset.columns = columns;
    dataset.rows = rows;
    dataset.rowAssignments = nextAssignments;
    dataset.markModified('columns');
    dataset.markModified('rows');
    dataset.markModified('rowAssignments');
    await dataset.save();

    const removedByEmployee = new Map();
    removedAssignments.forEach((assignment) => {
      const employeeId = String(assignment.employee);
      const existingRows = removedByEmployee.get(employeeId) || [];
      removedByEmployee.set(employeeId, [...existingRows, Number(assignment.rowIndex)]);
    });

    const actorName = await getUserLabel(req.user.id);
    await Promise.all(
      Array.from(removedByEmployee.entries()).map(([employeeId, removedRows]) =>
        createNotification({
          recipientRole: 'employee',
          recipientUser: employeeId,
          actorUser: req.user.id,
          actorName,
          actorRole: req.user.role,
          type: 'client_unassignment',
          title: 'Client data unassigned',
          message: `${removedRows.length} row${removedRows.length > 1 ? 's were' : ' was'} unassigned from ${dataset.name}.`,
          link: '/employee-dashboard/datasets',
          meta: {
            datasetId: dataset._id,
            rowIndexes: removedRows,
          },
        }),
      ),
    );

    return res.json({
      message: `${rowIndexes.length} rows unassigned`,
      columns,
      rows,
      rowAssignments: nextAssignments,
    });
  } catch (error) {
    console.error('Error unassigning client dataset rows:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

router.patch('/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const name = normalizeCell(req.body.name);
    const year = normalizeCell(req.body.year);
    const label = normalizeCell(req.body.label);
    const priority = normalizeCell(req.body.priority);
    const source = normalizeCell(req.body.source);
    const ownerAlias = normalizeCell(req.body.ownerAlias);
    const salesStage = normalizeCell(req.body.salesStage);

    if (!name) {
      return res.status(400).json({ message: 'Dataset name is required' });
    }

    const dataset = await ClientDataset.findOne({ _id: req.params.id, ...communityFilter(req) });

    if (!dataset) {
      return res.status(404).json({ message: 'Client dataset not found' });
    }

    dataset.name = name;
    dataset.year = year;
    if (label) dataset.label = label;
    if (['Low', 'Medium', 'High'].includes(priority)) dataset.priority = priority;
    if (source) dataset.source = source;
    if (ownerAlias) dataset.ownerAlias = ownerAlias;
    if (salesStage) dataset.salesStage = salesStage;
    await dataset.save();

    return res.json({
      message: 'Client data file updated successfully',
      dataset: getDatasetListItem(dataset),
    });
  } catch (error) {
    console.error('Error updating client dataset:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

router.patch('/labels/bulk', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const datasetIds = Array.isArray(req.body.datasetIds) ? req.body.datasetIds : [];
    const label = normalizeCell(req.body.label);
    const priority = normalizeCell(req.body.priority);
    const salesStage = normalizeCell(req.body.salesStage);

    if (datasetIds.length === 0) {
      return res.status(400).json({ message: 'Select at least one account list' });
    }

    if (!label && !priority && !salesStage) {
      return res.status(400).json({ message: 'Add a label, priority, or sales stage to update' });
    }

    const update = {};
    if (label) update.label = label;
    if (['Low', 'Medium', 'High'].includes(priority)) update.priority = priority;
    if (salesStage) update.salesStage = salesStage;

    await ClientDataset.updateMany(
      { _id: { $in: datasetIds }, ...communityFilter(req) },
      { $set: update },
    );
    const datasets = await ClientDataset.find({
      _id: { $in: datasetIds },
      ...communityFilter(req),
    });

    return res.json({
      message: `${datasets.length} account list${datasets.length === 1 ? '' : 's'} updated`,
      datasets: datasets.map(getDatasetListItem),
    });
  } catch (error) {
    console.error('Error updating account labels:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

router.post('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const name = normalizeCell(req.body.name);
    const year = normalizeCell(req.body.year);
    const accountName = normalizeCell(req.body.accountName);
    const phone = normalizeCell(req.body.phone);
    const website = normalizeCell(req.body.website);
    const billingCity = normalizeCell(req.body.billingCity);
    const billingState = normalizeCell(req.body.billingState);
    const label = normalizeCell(req.body.label) || 'Prospect List';
    const priority = normalizeCell(req.body.priority) || 'Medium';
    const source = normalizeCell(req.body.source) || 'Manual';
    const ownerAlias = normalizeCell(req.body.ownerAlias) || 'Admin';
    const salesStage = normalizeCell(req.body.salesStage) || 'Prospecting';
    const businessUnit = await resolveRequestedBusinessUnit(req);
    if (businessUnit === false)
      return res.status(403).json({ message: 'Business Unit access denied' });
    if (!businessUnit) return res.status(400).json({ message: 'Select a valid Business Unit' });
    const communityKey = businessUnit.legacyCommunityKey;

    if (!name) {
      return res.status(400).json({ message: 'Account list name is required' });
    }
    if (!accountName) {
      return res.status(400).json({ message: 'Account name is required' });
    }

    const accountColumns = [
      'Account Name',
      'Phone',
      'Website',
      'Billing City',
      'Billing State/Province',
      'Account Owner Alias',
    ];
    const accountRow = [accountName, phone, website, billingCity, billingState, ownerAlias];
    const normalizedAccountData = addWorkColumnsAfterWebsite(accountColumns, [accountRow]);

    const dataset = new ClientDataset({
      businessUnitId: businessUnit._id,
      communityKey,
      tableFormat: communityKey,
      name,
      year,
      label,
      priority: ['Low', 'Medium', 'High'].includes(priority) ? priority : 'Medium',
      source,
      ownerAlias,
      salesStage,
      originalFileName: 'Manual account list',
      columns: normalizedAccountData.columns,
      rows: normalizedAccountData.rows,
      rowCount: normalizedAccountData.rows.length,
      uploadedBy: req.user.id,
    });

    await dataset.save();
    await dataset.populate('businessUnitId', 'name slug legacyCommunityKey');

    return res.status(201).json({
      message: 'Account list created successfully',
      dataset: getDatasetListItem(dataset),
    });
  } catch (error) {
    console.error('Error creating account list:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

router.delete('/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const deletedDataset = await ClientDataset.findOneAndDelete({
      _id: req.params.id,
      ...communityFilter(req),
    });

    if (!deletedDataset) {
      return res.status(404).json({ message: 'Client dataset not found' });
    }

    return res.json({
      message: 'Client data file deleted successfully',
      datasetId: req.params.id,
    });
  } catch (error) {
    console.error('Error deleting client dataset:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

router.post('/upload', authMiddleware, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    const { name, year } = req.body;
    const businessUnit = await resolveRequestedBusinessUnit(req);
    if (businessUnit === false)
      return res.status(403).json({ message: 'Business Unit access denied' });
    if (!businessUnit) return res.status(400).json({ message: 'Select a valid Business Unit' });
    const communityKey = businessUnit.legacyCommunityKey;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Dataset name is required' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Excel file is required' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      blankrows: false,
      raw: false,
    });

    const headerRow = rawRows.find((row) => row.some((cell) => normalizeCell(cell)));
    if (!headerRow) {
      return res.status(400).json({ message: 'No header row found in the Excel file' });
    }

    const headerIndex = rawRows.indexOf(headerRow);
    const parsedColumns = headerRow.map(
      (cell, index) => normalizeCell(cell) || `Column ${index + 1}`,
    );
    const parsedRows = rawRows
      .slice(headerIndex + 1)
      .filter((row) => row.some((cell) => normalizeCell(cell)));
    const formattedData = applyBusinessUnitTableFormat(communityKey, parsedColumns, parsedRows);
    if (formattedData.error) return res.status(400).json({ message: formattedData.error });
    const { columns, rows } = formattedData;
    const filledRows = rows.filter((row) => row.some((cell) => cell));

    const dataset = new ClientDataset({
      businessUnitId: businessUnit._id,
      communityKey,
      tableFormat: formattedData.format,
      name: name.trim(),
      year: year?.trim() || '',
      label: normalizeCell(req.body.label) || 'Prospect List',
      priority: ['Low', 'Medium', 'High'].includes(normalizeCell(req.body.priority))
        ? normalizeCell(req.body.priority)
        : 'Medium',
      source: normalizeCell(req.body.source) || 'Excel Import',
      ownerAlias: normalizeCell(req.body.ownerAlias) || 'Admin',
      salesStage: normalizeCell(req.body.salesStage) || 'Prospecting',
      originalFileName: req.file.originalname,
      columns,
      rows: filledRows,
      rowCount: filledRows.length,
      uploadedBy: req.user.id,
    });

    await dataset.save();
    await dataset.populate('businessUnitId', 'name slug legacyCommunityKey');

    return res.status(201).json({
      message: 'Client data uploaded successfully',
      dataset: getDatasetListItem(dataset),
    });
  } catch (error) {
    console.error('Error uploading client dataset:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

module.exports = router;
