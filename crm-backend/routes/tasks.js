const express = require('express');
const ClientDataset = require('../models/ClientDataset');
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const { createNotification } = require('../utils/notifications');

const router = express.Router();

const CLIENT_WORK_COLUMNS = ['Status', 'Remark', 'Employee'];

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied: Admins only' });
  }
  return next();
};

const requireEmployee = (req, res, next) => {
  if (req.user.role !== 'employee') {
    return res.status(403).json({ message: 'Access denied: Employees only' });
  }
  return next();
};

const normalizeCell = (cell) => {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return cell.toISOString();
  return String(cell).trim();
};

const normalizeColumnName = (column) => normalizeCell(column).toLowerCase();

const addWorkColumnsAfterWebsite = (columns = [], rows = []) => {
  const normalizedColumns = columns.map(
    (column, index) => normalizeCell(column) || `Column ${index + 1}`,
  );
  const existingColumnNames = new Set(normalizedColumns.map(normalizeColumnName));
  const columnsToAdd = CLIENT_WORK_COLUMNS.filter(
    (column) => !existingColumnNames.has(column.toLowerCase()),
  );
  const normalizedRows = rows.map((row) =>
    normalizedColumns.map((column, index) => normalizeCell(row[index])),
  );

  if (columnsToAdd.length === 0) {
    return { columns: normalizedColumns, rows: normalizedRows };
  }

  const websiteIndex = normalizedColumns.findIndex(
    (column) => normalizeColumnName(column) === 'website',
  );
  const insertIndex = websiteIndex === -1 ? normalizedColumns.length : websiteIndex + 1;

  return {
    columns: [
      ...normalizedColumns.slice(0, insertIndex),
      ...columnsToAdd,
      ...normalizedColumns.slice(insertIndex),
    ],
    rows: normalizedRows.map((row) => [
      ...row.slice(0, insertIndex),
      ...columnsToAdd.map(() => ''),
      ...row.slice(insertIndex),
    ]),
  };
};

const getColumnIndex = (columns, candidates) => {
  const normalizedCandidates = candidates.map((candidate) => candidate.toLowerCase());
  return columns.findIndex((column) => normalizedCandidates.includes(normalizeColumnName(column)));
};

const getCellValue = (columns, row, candidates) => {
  const index = getColumnIndex(columns, candidates);
  return index === -1 ? '' : normalizeCell(row[index]);
};

const getUserLabel = async (userId) => {
  const user = await User.findById(userId).select('name email');
  return user?.name || user?.email || 'Employee';
};

const getAssignedRowsForEmployee = (datasets, employeeId) => {
  const assignedRows = [];

  datasets.forEach((dataset) => {
    const datasetObject = dataset.toObject();
    const { columns, rows } = addWorkColumnsAfterWebsite(
      datasetObject.columns || [],
      datasetObject.rows || [],
    );
    const assignments = datasetObject.rowAssignments || [];

    assignments
      .filter((assignment) => String(assignment.employee) === String(employeeId))
      .forEach((assignment) => {
        const rowIndex = Number(assignment.rowIndex);
        const row = rows[rowIndex];
        if (!row) return;

        const clientName =
          getCellValue(columns, row, ['Client Name', 'Client Name ']) ||
          getCellValue(columns, row, ['Company Name', 'Company Name ']) ||
          `Row ${rowIndex + 1}`;
        const companyName = getCellValue(columns, row, ['Company Name', 'Company Name ']);

        assignedRows.push({
          datasetId: datasetObject._id,
          datasetName: datasetObject.name,
          year: datasetObject.year,
          rowIndex,
          serialNumber: rowIndex + 1,
          clientName,
          companyName,
          city: getCellValue(columns, row, ['City']),
          phone: getCellValue(columns, row, ['Mobile 1', 'Mobile 1 ', 'Mobile']),
          email: getCellValue(columns, row, ['Email 1', 'Email 1 ', 'Email']),
          status: getCellValue(columns, row, ['Status']),
          website: getCellValue(columns, row, ['Website']),
        });
      });
  });

  return assignedRows;
};

router.get('/employee/assigned-rows', authMiddleware, requireEmployee, async (req, res) => {
  try {
    const datasets = await ClientDataset.find({ 'rowAssignments.employee': req.user.id });
    return res.json(getAssignedRowsForEmployee(datasets, req.user.id));
  } catch (error) {
    console.error('Error fetching assigned rows:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/meetings/me', authMiddleware, requireEmployee, async (req, res) => {
  try {
    const meetings = await Meeting.find({ employee: req.user.id }).sort({
      meetingDate: 1,
      meetingTime: 1,
    });
    return res.json(meetings);
  } catch (error) {
    console.error('Error fetching employee meetings:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/meetings', authMiddleware, requireEmployee, async (req, res) => {
  try {
    const {
      datasetId,
      rowIndex,
      meetingTitle,
      meetingDate,
      meetingTime,
      meetingMode,
      platformOrLocation,
      notes,
    } = req.body;

    const normalizedRowIndex = Number(rowIndex);
    if (!datasetId || !Number.isInteger(normalizedRowIndex) || normalizedRowIndex < 0) {
      return res.status(400).json({ message: 'Select a valid assigned client' });
    }

    if (!meetingTitle || !meetingDate || !meetingTime) {
      return res.status(400).json({ message: 'Meeting title, date, and time are required' });
    }

    const dataset = await ClientDataset.findById(datasetId);
    if (!dataset) {
      return res.status(404).json({ message: 'Dataset not found' });
    }

    const assignment = (dataset.rowAssignments || []).find(
      (item) =>
        Number(item.rowIndex) === normalizedRowIndex &&
        String(item.employee) === String(req.user.id),
    );

    if (!assignment) {
      return res.status(403).json({ message: 'This client data is not assigned to you' });
    }

    const { columns, rows } = addWorkColumnsAfterWebsite(dataset.columns || [], dataset.rows || []);
    const row = rows[normalizedRowIndex];
    if (!row) {
      return res.status(404).json({ message: 'Assigned row not found' });
    }

    const companyName = getCellValue(columns, row, ['Company Name', 'Company Name ']);
    const clientName =
      getCellValue(columns, row, ['Client Name', 'Client Name ']) ||
      companyName ||
      `Row ${normalizedRowIndex + 1}`;

    const meeting = new Meeting({
      employee: req.user.id,
      dataset: dataset._id,
      rowIndex: normalizedRowIndex,
      datasetName: dataset.name,
      clientName,
      companyName,
      meetingTitle: normalizeCell(meetingTitle),
      meetingDate: normalizeCell(meetingDate),
      meetingTime: normalizeCell(meetingTime),
      meetingMode: ['Physical', 'Online', 'Phone'].includes(meetingMode) ? meetingMode : 'Online',
      platformOrLocation: normalizeCell(platformOrLocation),
      notes: normalizeCell(notes),
    });

    await meeting.save();
    const actorName = await getUserLabel(req.user.id);

    await createNotification({
      recipientRole: 'admin',
      actorUser: req.user.id,
      actorName,
      actorRole: req.user.role,
      type: 'meeting_scheduled',
      title: `${actorName} scheduled a meeting`,
      message: `${meeting.meetingTitle} with ${clientName} on ${meeting.meetingDate} at ${meeting.meetingTime}.`,
      link: '/dashboard/tasks',
      meta: {
        meetingId: meeting._id,
        datasetId: dataset._id,
        rowIndex: normalizedRowIndex,
      },
    });

    return res.status(201).json({ message: 'Meeting scheduled successfully', meeting });
  } catch (error) {
    console.error('Error scheduling meeting:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

router.get('/admin-summary', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const [employees, datasets, meetings] = await Promise.all([
      User.find({ role: 'employee' }).select('name email position imageUrl'),
      ClientDataset.find(),
      Meeting.find()
        .populate('employee', 'name email position')
        .sort({ meetingDate: 1, meetingTime: 1 }),
    ]);

    const taskRows = [];
    const employeeStats = new Map(
      employees.map((employee) => [
        String(employee._id),
        {
          _id: employee._id,
          name: employee.name,
          email: employee.email,
          position: employee.position,
          imageUrl: employee.imageUrl,
          assignedCount: 0,
          followUpCount: 0,
          pendingCallCount: 0,
          statusCounts: {},
          meetingCount: 0,
          upcomingMeetingCount: 0,
        },
      ]),
    );

    datasets.forEach((dataset) => {
      const datasetObject = dataset.toObject();
      const { columns, rows } = addWorkColumnsAfterWebsite(
        datasetObject.columns || [],
        datasetObject.rows || [],
      );
      const statusIndex = getColumnIndex(columns, ['Status']);

      (datasetObject.rowAssignments || []).forEach((assignment) => {
        const employeeId = String(assignment.employee);
        const stat = employeeStats.get(employeeId);
        if (!stat) return;

        const row = rows[Number(assignment.rowIndex)];
        const status = normalizeCell(row?.[statusIndex]) || 'Pending';

        stat.assignedCount += 1;
        stat.statusCounts[status] = (stat.statusCounts[status] || 0) + 1;
        if (status === 'Follow Up') stat.followUpCount += 1;
        if (status === 'Pending') stat.pendingCallCount += 1;

        if (row) {
          const rowIndex = Number(assignment.rowIndex);
          const companyName = getCellValue(columns, row, ['Company Name', 'Company Name ']);
          const clientName =
            getCellValue(columns, row, ['Client Name', 'Client Name ']) ||
            companyName ||
            getCellValue(columns, row, ['Account Name']) ||
            `Row ${rowIndex + 1}`;

          taskRows.push({
            _id: `${datasetObject._id}-${rowIndex}`,
            datasetId: datasetObject._id,
            datasetName: datasetObject.name,
            year: datasetObject.year,
            rowIndex,
            serialNumber: rowIndex + 1,
            employeeId,
            employeeName: stat.name || stat.email || 'Employee',
            employeeEmail: stat.email || '',
            employeePosition: stat.position || '',
            clientName,
            companyName,
            city: getCellValue(columns, row, ['City', 'Billing City']),
            phone: getCellValue(columns, row, [
              'Mobile 1',
              'Mobile 1 ',
              'Mobile',
              'Phone',
              'Contact Number',
            ]),
            email: getCellValue(columns, row, ['Email 1', 'Email 1 ', 'Email']),
            website: getCellValue(columns, row, ['Website', 'URL']),
            status,
            remark: getCellValue(columns, row, ['Remark']),
            assignedAt: assignment.assignedAt || null,
          });
        }
      });
    });

    const today = new Date().toISOString().slice(0, 10);
    meetings.forEach((meeting) => {
      const employeeId = String(meeting.employee?._id || meeting.employee);
      const stat = employeeStats.get(employeeId);
      if (!stat) return;

      stat.meetingCount += 1;
      if (meeting.meetingDate >= today) stat.upcomingMeetingCount += 1;
    });

    const employeeSummaries = Array.from(employeeStats.values());
    const upcomingMeetingCount = meetings.filter((meeting) => meeting.meetingDate >= today).length;
    const overdueMeetingCount = meetings.filter((meeting) => meeting.meetingDate < today).length;
    const totalStatusCount = (statusName) =>
      employeeSummaries.reduce(
        (total, employee) => total + (employee.statusCounts[statusName] || 0),
        0,
      );

    return res.json({
      employees: employeeSummaries,
      meetings,
      tasks: taskRows.sort((a, b) => {
        const statusPriority = {
          'Follow Up': 0,
          Pending: 1,
          Contacted: 2,
          Interested: 3,
          Converted: 4,
        };
        const aPriority = statusPriority[a.status] ?? 5;
        const bPriority = statusPriority[b.status] ?? 5;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return new Date(b.assignedAt || 0) - new Date(a.assignedAt || 0);
      }),
      totals: {
        employees: employees.length,
        assignedData: employeeSummaries.reduce(
          (total, employee) => total + employee.assignedCount,
          0,
        ),
        followUps: employeeSummaries.reduce((total, employee) => total + employee.followUpCount, 0),
        pendingCalls: employeeSummaries.reduce(
          (total, employee) => total + employee.pendingCallCount,
          0,
        ),
        contacted: totalStatusCount('Contacted'),
        interested: totalStatusCount('Interested'),
        converted: totalStatusCount('Converted'),
        meetings: meetings.length,
        upcomingMeetings: upcomingMeetingCount,
        pastMeetings: overdueMeetingCount,
      },
    });
  } catch (error) {
    console.error('Error fetching admin task summary:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
