const express = require('express');
const ClientDataset = require('../models/ClientDataset');
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const BusinessCampaign = require('../models/BusinessCampaign');
const FinanceRecord = require('../models/FinanceRecord');
const BusinessProject = require('../models/BusinessProject');
const BusinessProjectTask = require('../models/BusinessProjectTask');
const DocumentRecord = require('../models/DocumentRecord');
const CommunicationLog = require('../models/CommunicationLog');
const Quotation = require('../models/Quotation');
const RolePermission = require('../models/RolePermission');
const OfficeStructure = require('../models/OfficeStructure');
const Community = require('../models/Community');
const authMiddleware = require('../middleware/authMiddleware');
const {
  MODULES,
  UNIVERSAL_COMMUNITIES,
  COMMUNITY_KEYS,
} = require('../config/accessControl');
const { loadAuthorization } = require('../middleware/authorization');
const {
  getPermission,
  buildScopeQuery,
  getAuthorizedCommunities,
} = require('../services/accessControlService');
const { writeAuditLog } = require('../services/auditService');
const { ensureAccessFoundation } = require('../services/organizationAccessService');

const router = express.Router();

const taskStatuses = ['Backlog', 'To Do', 'In Progress', 'Review', 'Complete'];

const defaultOfficeModules = [
  'Sales',
  'Marketing',
  'Accounts',
  'Projects',
  'Operations',
  'Support',
];

const defaultOfficeTeams = [
  { name: 'Sales Team', moduleName: 'Sales' },
  { name: 'Lead Generation', moduleName: 'Sales' },
  { name: 'Performance Marketing', moduleName: 'Marketing' },
  { name: 'Content Team', moduleName: 'Marketing' },
  { name: 'Creative Team', moduleName: 'Marketing' },
  { name: 'Billing Team', moduleName: 'Accounts' },
  { name: 'Delivery Team', moduleName: 'Projects' },
  { name: 'Engineering Team', moduleName: 'Projects' },
  { name: 'Operations Team', moduleName: 'Operations' },
  { name: 'Support Team', moduleName: 'Support' },
];

const defaultDesignationNames = ['Intern', 'Junior', 'Senior', 'Manager', 'Head'];

const defaultCampaigns = [
  {
    name: 'Google Search SaaS Leads',
    channel: 'Google Ads',
    spend: 185000,
    impressions: 920000,
    clicks: 18400,
    leads: 248,
    conversions: 31,
    roi: 3.8,
    cpl: 746,
    ctr: 2.0,
    status: 'Active',
    owner: 'Marketing',
  },
  {
    name: 'Meta Retargeting Hospitals',
    channel: 'Meta Ads',
    spend: 125000,
    impressions: 640000,
    clicks: 12800,
    leads: 172,
    conversions: 19,
    roi: 3.1,
    cpl: 727,
    ctr: 2.0,
    status: 'Active',
    owner: 'Marketing',
  },
  {
    name: 'LinkedIn Enterprise Demo',
    channel: 'LinkedIn',
    spend: 95000,
    impressions: 140000,
    clicks: 4200,
    leads: 58,
    conversions: 8,
    roi: 2.4,
    cpl: 1638,
    ctr: 3.0,
    status: 'Active',
    owner: 'Marketing',
  },
];

const defaultFinance = [
  {
    type: 'quotation',
    code: 'QT-1001',
    client: 'Fortis Healthcare',
    amount: 1250000,
    gst: 225000,
    discount: 50000,
    paid: 0,
    issueDate: '2026-06-08',
    dueDate: '2026-06-22',
    status: 'Sent',
    owner: 'Sales',
  },
  {
    type: 'quotation',
    code: 'QT-1002',
    client: 'Hyatt Centric',
    amount: 760000,
    gst: 136800,
    discount: 25000,
    paid: 0,
    issueDate: '2026-06-10',
    dueDate: '2026-06-24',
    status: 'Revised',
    owner: 'Sales',
  },
  {
    type: 'invoice',
    code: 'INV-9001',
    client: 'Hyatt Centric',
    amount: 420000,
    gst: 75600,
    discount: 0,
    paid: 495600,
    dueDate: '2026-06-18',
    status: 'Paid',
    owner: 'Accounts',
  },
  {
    type: 'invoice',
    code: 'INV-9002',
    client: 'Fortis Healthcare',
    amount: 650000,
    gst: 117000,
    discount: 0,
    paid: 200000,
    dueDate: '2026-06-20',
    status: 'Partially Paid',
    owner: 'Accounts',
  },
  {
    type: 'invoice',
    code: 'INV-9003',
    client: 'Sodexo India',
    amount: 380000,
    gst: 68400,
    discount: 0,
    paid: 0,
    dueDate: '2026-06-09',
    status: 'Overdue',
    owner: 'Accounts',
  },
];

const defaultProjects = [
  {
    name: 'Fortis Business OS MVP',
    client: 'Fortis Healthcare',
    owner: 'Project Manager',
    ownerEmail: 'project@demo.com',
    assignedTeam: [
      { name: 'Project Manager', email: 'project@demo.com' },
      { name: 'Sales Manager', email: 'sales@demo.com' },
    ],
    visibilityUsers: ['admin@company.com', 'project@demo.com', 'sales@demo.com'],
    documentAccessUsers: ['admin@company.com', 'project@demo.com'],
    deadline: '2026-07-20',
    priority: 'High',
    stage: 'SOW Drafting',
    health: 'At Risk',
    progress: 22,
    notes: 'Scope needs approval from senior stakeholders.',
  },
  {
    name: 'Hyatt CMS Expansion',
    client: 'Hyatt Centric',
    owner: 'Project Manager',
    ownerEmail: 'project@demo.com',
    assignedTeam: [{ name: 'Project Manager', email: 'project@demo.com' }],
    visibilityUsers: ['admin@company.com', 'project@demo.com'],
    documentAccessUsers: ['admin@company.com', 'project@demo.com'],
    deadline: '2026-07-05',
    priority: 'Medium',
    stage: 'Development Phase',
    health: 'Healthy',
    progress: 58,
    notes: 'CMS and branch reporting are progressing well.',
  },
];

const defaultDocuments = [
  {
    name: 'Fortis SOW Draft',
    type: 'SOW',
    project: 'Fortis Business OS MVP',
    owner: 'Project Manager',
    access: 'Internal',
    uploadedAt: '2026-06-10',
  },
  {
    name: 'Hyatt Quotation v2',
    type: 'Quotation',
    project: 'Hyatt CMS Expansion',
    owner: 'Sales Manager',
    access: 'Client View',
    uploadedAt: '2026-06-10',
  },
  {
    name: 'Project WBS Template',
    type: 'WBS',
    project: 'All Projects',
    owner: 'Project Manager',
    access: 'Internal',
    uploadedAt: '2026-06-06',
  },
];

const defaultCommunications = [
  {
    clientName: 'Fortis Healthcare',
    contact: 'Procurement Head',
    channel: 'Email',
    type: 'Proposal',
    message: 'Proposal introduction shared with software overview.',
    status: 'Sent',
    owner: 'Sales Manager',
  },
  {
    clientName: 'Hyatt Centric',
    contact: 'IT Manager',
    channel: 'WhatsApp',
    type: 'Follow-up',
    message: 'Commercial clarification shared.',
    status: 'Sent',
    owner: 'Sales Manager',
  },
];

const requireAdmin = (req, res, next) => {
  if (!getPermission(req.effectivePermissions || [], 'permission_management', 'manage'))
    return res
      .status(403)
      .json({ message: 'Access denied: permission_management.manage required' });
  return next();
};

const hasModuleAccess = async (user, moduleKey) => {
  if (user.roleKey === 'super_admin') return true;
  return Boolean(moduleKey);
};

const requireModule = (moduleKey) => async (req, res, next) => {
  if (await hasModuleAccess(req.user, moduleKey)) return next();
  return res.status(403).json({ message: `Access denied: ${moduleKey} permission required` });
};

const normalizeCell = (cell) => {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return cell.toISOString();
  return String(cell).trim();
};

const normalizeColumnName = (column) => normalizeCell(column).toLowerCase();

const getColumnIndex = (columns, names) => {
  const lowered = names.map((name) => name.toLowerCase());
  return columns.findIndex((column) => lowered.includes(normalizeColumnName(column)));
};

const addWorkColumnsAfterWebsite = (columns = [], rows = []) => {
  const normalizedColumns = columns.map(
    (column, index) => normalizeCell(column) || `Column ${index + 1}`,
  );
  const existing = new Set(normalizedColumns.map(normalizeColumnName));
  const columnsToAdd = ['Status', 'Remark', 'Employee'].filter(
    (column) => !existing.has(column.toLowerCase()),
  );
  const normalizedRows = rows.map((row) =>
    normalizedColumns.map((column, index) => normalizeCell(row[index])),
  );

  if (!columnsToAdd.length) return { columns: normalizedColumns, rows: normalizedRows };

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

const toCurrencyNumber = (value) => Number(value || 0);

const formatCodePrefix = (type) => (type === 'invoice' ? 'INV' : 'QT');

const ensureDefaults = async (createdBy) => {
  await ensureAccessFoundation();
  await RolePermission.deleteOne({ roleKey: 'admin' });

  await Promise.all(
    UNIVERSAL_COMMUNITIES.map((community) =>
      Community.updateOne(
        { key: community.key },
        { $set: { ...community, active: true }, $setOnInsert: { createdBy } },
        { upsert: true },
      ),
    ),
  );

  await User.updateMany(
    {
      role: 'admin',
      $or: [
        { roleKey: { $ne: 'super_admin' } },
        { crmRole: { $ne: 'super_admin' } },
        { communities: { $not: { $all: COMMUNITY_KEYS } } },
      ],
    },
    {
      $set: {
        roleKey: 'super_admin',
        crmRole: 'super_admin',
        communities: COMMUNITY_KEYS,
        primaryCommunity: 'live',
      },
    },
  );

  if ((await OfficeStructure.countDocuments()) === 0) {
    await OfficeStructure.insertMany([
      ...defaultOfficeModules.map((name) => ({ type: 'module', name, createdBy })),
      ...defaultOfficeTeams.map((team) => ({ type: 'team', ...team, createdBy })),
    ]);
  }

  await Promise.all(
    defaultOfficeTeams.map((team) =>
      OfficeStructure.updateOne(
        { type: 'team', name: team.name },
        { $setOnInsert: { type: 'team', ...team, createdBy } },
        { upsert: true },
      ),
    ),
  );

  const teamNames = await OfficeStructure.distinct('name', { type: 'team' });
  const legacyDesignations = await OfficeStructure.find({ type: 'designation', moduleName: '' });
  await Promise.all(
    legacyDesignations.map((designation) =>
      OfficeStructure.updateOne(
        { _id: designation._id },
        { $set: { moduleName: designation.teamName } },
      ),
    ),
  );
  await Promise.all(
    teamNames.flatMap((teamName) =>
      defaultDesignationNames.map((name) =>
        OfficeStructure.updateOne(
          { type: 'designation', name, teamName },
          {
            $setOnInsert: { type: 'designation', name, teamName, moduleName: teamName, createdBy },
          },
          { upsert: true },
        ),
      ),
    ),
  );

  if ((await BusinessCampaign.countDocuments()) === 0) {
    await BusinessCampaign.insertMany(defaultCampaigns.map((item) => ({ ...item, createdBy })));
  }

  if ((await FinanceRecord.countDocuments()) === 0) {
    await FinanceRecord.insertMany(defaultFinance.map((item) => ({ ...item, createdBy })));
  }

  if ((await BusinessProject.countDocuments()) === 0) {
    const projects = await BusinessProject.insertMany(
      defaultProjects.map((item) => ({ ...item, createdBy })),
    );
    const [fortis, hyatt] = projects;
    await BusinessProjectTask.insertMany([
      {
        project: fortis._id,
        projectName: fortis.name,
        name: 'Prepare final SOW',
        assignee: 'Project Manager',
        assigneeEmail: 'project@demo.com',
        team: 'Delivery',
        due: '2026-06-26',
        status: 'In Progress',
        progress: 70,
        priority: 'High',
        createdBy,
      },
      {
        project: fortis._id,
        projectName: fortis.name,
        name: 'Confirm integration APIs',
        assignee: 'Sales Manager',
        assigneeEmail: 'sales@demo.com',
        team: 'Engineering',
        due: '2026-06-28',
        status: 'To Do',
        progress: 10,
        priority: 'High',
        dependency: 'Prepare final SOW',
        createdBy,
      },
      {
        project: hyatt._id,
        projectName: hyatt.name,
        name: 'Branch dashboard build',
        assignee: 'Project Manager',
        assigneeEmail: 'project@demo.com',
        team: 'Engineering',
        due: '2026-06-24',
        status: 'In Progress',
        progress: 45,
        priority: 'Medium',
        createdBy,
      },
      {
        project: hyatt._id,
        projectName: hyatt.name,
        name: 'Client review deck',
        assignee: 'Sales Manager',
        assigneeEmail: 'sales@demo.com',
        team: 'Delivery',
        due: '2026-06-30',
        status: 'Review',
        progress: 80,
        priority: 'Medium',
        milestone: true,
        createdBy,
      },
    ]);
  }

  if ((await DocumentRecord.countDocuments()) === 0) {
    await DocumentRecord.insertMany(defaultDocuments.map((item) => ({ ...item, createdBy })));
  }

  if ((await CommunicationLog.countDocuments()) === 0) {
    await CommunicationLog.insertMany(
      defaultCommunications.map((item) => ({ ...item, createdBy })),
    );
  }
};

const getWorkStructure = async () => {
  const [modules, teams, designations] = await Promise.all([
    OfficeStructure.find({ type: 'module' }).sort({ name: 1 }),
    OfficeStructure.find({ type: 'team' }).sort({ name: 1 }),
    OfficeStructure.find({ type: 'designation' }).sort({ teamName: 1, name: 1 }),
  ]);

  return { modules, teams, designations };
};

const buildAssignedTaskQuery = (employee) => ({
  $or: [{ assigneeEmail: employee.email }, { assignee: employee.name }],
});

const getDatasetSummary = (dataset) => {
  const { columns, rows } = addWorkColumnsAfterWebsite(dataset.columns || [], dataset.rows || []);
  const statusIndex = getColumnIndex(columns, ['Status']);
  const employeeIndex = getColumnIndex(columns, ['Employee']);
  const counts = rows.reduce(
    (accumulator, row, rowIndex) => {
      const status = statusIndex === -1 ? '' : normalizeCell(row[statusIndex]).toLowerCase();
      const assigned =
        (dataset.rowAssignments || []).some(
          (assignment) => Number(assignment.rowIndex) === rowIndex,
        ) ||
        (employeeIndex !== -1 && normalizeCell(row[employeeIndex]));

      if (assigned) accumulator.assigned += 1;
      if (status === 'converted') accumulator.converted += 1;
      if (status === 'interested') accumulator.interested += 1;
      if (status === 'follow up' || status === 'follow-up') accumulator.followUps += 1;
      if (status === 'pending' || !status) accumulator.pending += 1;
      return accumulator;
    },
    {
      total: rows.length,
      assigned: 0,
      pending: 0,
      followUps: 0,
      interested: 0,
      converted: 0,
    },
  );

  return {
    ...counts,
    unassigned: Math.max(counts.total - counts.assigned, 0),
    conversionRate: counts.total ? Math.round((counts.converted / counts.total) * 100) : 0,
  };
};

const buildSummary = async (communityKeys) => {
  const communityQuery = { communityKey: { $in: communityKeys } };
  const [employees, datasets, meetings, quotations] = await Promise.all([
    User.find({
      role: 'employee',
      communities: { $in: communityKeys },
      isDeleted: { $ne: true },
    }).select(
      'name email employeeId position officeModule team communities accountStatus lastLoginAt',
    ),
    ClientDataset.find(communityQuery).sort({ updatedAt: -1 }),
    Meeting.find(communityQuery)
      .populate('employee', 'name email employeeId')
      .sort({ meetingDate: 1, meetingTime: 1 }),
    Quotation.find(communityQuery)
      .populate('createdBy', 'name email employeeId')
      .sort({ updatedAt: -1 }),
  ]);

  const sales = datasets.reduce(
    (accumulator, dataset) => {
      const current = getDatasetSummary(dataset);
      Object.keys(current).forEach((key) => {
        accumulator[key] = (accumulator[key] || 0) + current[key];
      });
      return accumulator;
    },
    {
      total: 0,
      assigned: 0,
      pending: 0,
      followUps: 0,
      interested: 0,
      converted: 0,
      unassigned: 0,
    },
  );
  sales.conversionRate = sales.total ? Math.round((sales.converted / sales.total) * 100) : 0;

  const today = new Date().toISOString().slice(0, 10);
  const upcomingMeetings = meetings.filter(
    (meeting) => meeting.status === 'scheduled' && meeting.meetingDate >= today,
  );
  const todayMeetings = upcomingMeetings.filter((meeting) => meeting.meetingDate === today);
  const sentQuotations = quotations.filter((quotation) => quotation.status === 'Sent');
  const acceptedQuotations = quotations.filter((quotation) => quotation.status === 'Accepted');
  const quotationValue = quotations.reduce(
    (sum, quotation) => sum + toCurrencyNumber(quotation.grandTotal),
    0,
  );
  const verticalNames = {
    marketing: 'BrainADZ Marketing',
    exhibition: 'BrainADZ Exhibits',
    live: 'BrainADZ Live',
  };
  const verticals = communityKeys.map((communityKey) => {
    const verticalDatasets = datasets.filter((dataset) => dataset.communityKey === communityKey);
    const verticalSales = verticalDatasets.reduce(
      (total, dataset) => {
        const current = getDatasetSummary(dataset);
        Object.keys(current).forEach((key) => {
          total[key] = (total[key] || 0) + current[key];
        });
        return total;
      },
      {
        total: 0,
        assigned: 0,
        pending: 0,
        followUps: 0,
        interested: 0,
        converted: 0,
        unassigned: 0,
      },
    );
    verticalSales.conversionRate = verticalSales.total
      ? Math.round((verticalSales.converted / verticalSales.total) * 100)
      : 0;
    const verticalQuotations = quotations.filter(
      (quotation) => quotation.communityKey === communityKey,
    );

    return {
      key: communityKey,
      name: verticalNames[communityKey] || communityKey,
      employees: employees.filter((employee) => employee.communities.includes(communityKey)).length,
      datasets: verticalDatasets.length,
      sales: verticalSales,
      meetings: meetings.filter((meeting) => meeting.communityKey === communityKey).length,
      quotations: verticalQuotations.length,
      quotationValue: verticalQuotations.reduce(
        (sum, quotation) => sum + toCurrencyNumber(quotation.grandTotal),
        0,
      ),
    };
  });

  return {
    employees: employees.length,
    datasets: datasets.length,
    meetings: meetings.length,
    sales,
    meetingStats: {
      total: meetings.length,
      upcoming: upcomingMeetings.length,
      today: todayMeetings.length,
      completed: meetings.filter((meeting) => meeting.status === 'completed').length,
    },
    quotationStats: {
      total: quotations.length,
      draft: quotations.filter((quotation) => quotation.status === 'Draft').length,
      sent: sentQuotations.length,
      accepted: acceptedQuotations.length,
      value: quotationValue,
      acceptedValue: acceptedQuotations.reduce(
        (sum, quotation) => sum + toCurrencyNumber(quotation.grandTotal),
        0,
      ),
    },
    verticals,
    recent: {
      datasets: datasets.slice(0, 5),
      meetings: upcomingMeetings.slice(0, 5),
      quotations: quotations.slice(0, 5),
      employees: [...employees]
        .sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0))
        .slice(0, 5),
    },
  };
};

const resourceConfig = {
  campaigns: {
    model: BusinessCampaign,
    permissionResource: 'campaigns',
    sort: { updatedAt: -1 },
  },
  finance: {
    model: FinanceRecord,
    permissionResource: 'accounting',
    sort: { updatedAt: -1 },
    beforeCreate: async (payload) => {
      const type = payload.type === 'invoice' ? 'invoice' : 'quotation';
      if (payload.code) return { ...payload, type };
      const count = await FinanceRecord.countDocuments({ type });
      return { ...payload, type, code: `${formatCodePrefix(type)}-${String(1000 + count + 1)}` };
    },
  },
  projects: {
    model: BusinessProject,
    permissionResource: 'projects',
    sort: { updatedAt: -1 },
  },
  'project-tasks': {
    model: BusinessProjectTask,
    permissionResource: 'tasks',
    sort: { due: 1, updatedAt: -1 },
    beforeCreate: async (payload) => {
      if (!payload.project) return payload;
      const project = await BusinessProject.findById(payload.project);
      return {
        ...payload,
        projectName: payload.projectName || project?.name || '',
      };
    },
  },
  documents: {
    model: DocumentRecord,
    permissionResource: 'documents',
    sort: { updatedAt: -1 },
  },
  communications: {
    model: CommunicationLog,
    permissionResource: 'communication',
    sort: { createdAt: -1 },
  },
};

router.use(authMiddleware, loadAuthorization);

router.get('/summary', requireModule('dashboard'), async (req, res) => {
  try {
    const permission = getPermission(req.effectivePermissions, 'dashboard', 'view');
    if (!permission)
      return res.status(403).json({ message: 'Access denied: dashboard.view required' });
    const summary = await buildSummary(getAuthorizedCommunities(req.user, req.selectedCommunity));
    return res.json(summary);
  } catch (error) {
    console.error('Error building business summary:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

router.get('/permissions', requireAdmin, async (req, res) => {
  try {
    await ensureDefaults(req.user.id);
    const [roles, communities, superAdmins] = await Promise.all([
      RolePermission.find().sort({ locked: -1, roleLabel: 1 }),
      Community.find({ active: true }).sort({ createdAt: 1 }),
      User.find({ role: 'admin', crmRole: 'super_admin' }).select('name email crmRole communities'),
    ]);
    return res.json({ modules: MODULES, roles, communities, superAdmins });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/permissions/:roleKey', requireAdmin, async (req, res) => {
  try {
    await ensureDefaults(req.user.id);
    const allowedModuleKeys = new Set(MODULES.map((module) => module.key));
    const modules = Array.isArray(req.body.modules)
      ? req.body.modules.filter((moduleKey) => allowedModuleKeys.has(moduleKey))
      : [];

    const role = await RolePermission.findOne({ roleKey: req.params.roleKey });
    if (!role) return res.status(404).json({ message: 'Role not found' });
    if (role.locked) return res.status(400).json({ message: 'Locked roles cannot be changed' });

    role.modules = modules;
    await role.save();
    return res.json({ message: 'Permissions updated', role });
  } catch (error) {
    console.error('Error updating permissions:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

router.get('/work-structure', async (req, res) => {
  try {
    await ensureDefaults(req.user.id);
    return res.json(await getWorkStructure());
  } catch (error) {
    console.error('Error fetching work structure:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

router.post('/work-structure/modules', requireAdmin, async (req, res) => {
  try {
    await ensureDefaults(req.user.id);
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Module name is required' });

    await OfficeStructure.create({ type: 'module', name, createdBy: req.user.id });
    return res.status(201).json({ message: 'Module added', ...(await getWorkStructure()) });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'Module already exists' });
    console.error('Error creating module:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

router.post('/work-structure/teams', requireAdmin, async (req, res) => {
  try {
    await ensureDefaults(req.user.id);
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Team name is required' });
    if (await OfficeStructure.exists({ type: 'team', name }))
      return res.status(400).json({ message: 'Team already exists' });

    await OfficeStructure.create({ type: 'team', name, moduleName: '', createdBy: req.user.id });
    await Promise.all(
      defaultDesignationNames.map((designationName) =>
        OfficeStructure.updateOne(
          { type: 'designation', name: designationName, teamName: name },
          {
            $setOnInsert: {
              type: 'designation',
              name: designationName,
              teamName: name,
              moduleName: name,
              createdBy: req.user.id,
            },
          },
          { upsert: true },
        ),
      ),
    );
    return res.status(201).json({ message: 'Team added', ...(await getWorkStructure()) });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'Team already exists' });
    console.error('Error creating team:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

router.delete('/work-structure/modules/:id', requireAdmin, async (req, res) => {
  try {
    await ensureDefaults(req.user.id);
    const moduleItem = await OfficeStructure.findOneAndDelete({
      _id: req.params.id,
      type: 'module',
    });
    if (!moduleItem) return res.status(404).json({ message: 'Module not found' });

    await OfficeStructure.deleteMany({ type: 'team', moduleName: moduleItem.name });
    return res.json({ message: 'Module removed', ...(await getWorkStructure()) });
  } catch (error) {
    console.error('Error deleting module:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

router.delete('/work-structure/teams/:id', requireAdmin, async (req, res) => {
  try {
    await ensureDefaults(req.user.id);
    const teamItem = await OfficeStructure.findOneAndDelete({ _id: req.params.id, type: 'team' });
    if (!teamItem) return res.status(404).json({ message: 'Team not found' });

    await OfficeStructure.deleteMany({ type: 'designation', teamName: teamItem.name });

    return res.json({ message: 'Team removed', ...(await getWorkStructure()) });
  } catch (error) {
    console.error('Error deleting team:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

router.post('/work-structure/designations', requireAdmin, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const teamName = String(req.body.teamName || '').trim();
    if (!name || !teamName)
      return res.status(400).json({ message: 'Designation and team are required' });
    if (!(await OfficeStructure.exists({ type: 'team', name: teamName })))
      return res.status(400).json({ message: 'Selected team does not exist' });
    await OfficeStructure.create({
      type: 'designation',
      name,
      teamName,
      moduleName: teamName,
      createdBy: req.user.id,
    });
    return res.status(201).json({ message: 'Designation added', ...(await getWorkStructure()) });
  } catch (error) {
    if (error.code === 11000)
      return res.status(400).json({ message: 'Designation already exists in this team' });
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

router.delete('/work-structure/designations/:id', requireAdmin, async (req, res) => {
  try {
    const designation = await OfficeStructure.findOneAndDelete({
      _id: req.params.id,
      type: 'designation',
    });
    if (!designation) return res.status(404).json({ message: 'Designation not found' });
    return res.json({ message: 'Designation removed', ...(await getWorkStructure()) });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

router.get('/:resource', async (req, res) => {
  try {
    const config = resourceConfig[req.params.resource];
    if (!config) return res.status(404).json({ message: 'Resource not found' });

    const permission = getPermission(req.effectivePermissions, config.permissionResource, 'view');
    if (!permission)
      return res
        .status(403)
        .json({ message: `Access denied: ${config.permissionResource}.view required` });

    await ensureDefaults(req.user.id);
    let query = buildScopeQuery(req.user, permission.scope, req.selectedCommunity);
    if (req.params.resource === 'project-tasks' && req.user.role === 'employee') {
      const employee = await User.findById(req.user.id).select('name email');
      if (!employee) return res.status(404).json({ message: 'Employee not found' });
      query = { $and: [query, buildAssignedTaskQuery(employee)] };
    }

    const items = await config.model.find(query).sort(config.sort);
    return res.json(items);
  } catch (error) {
    console.error(`Error fetching ${req.params.resource}:`, error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:resource', async (req, res) => {
  try {
    const config = resourceConfig[req.params.resource];
    if (!config) return res.status(404).json({ message: 'Resource not found' });
    if (!getPermission(req.effectivePermissions, config.permissionResource, 'create'))
      return res
        .status(403)
        .json({ message: `Access denied: ${config.permissionResource}.create required` });

    await ensureDefaults(req.user.id);
    const requestedCommunity = String(
      req.body.communityKey || req.selectedCommunity || '',
    ).toLowerCase();
    if (!requestedCommunity) return res.status(400).json({ message: 'Community is required' });
    if (req.user.roleKey !== 'super_admin' && !req.user.communities.includes(requestedCommunity))
      return res.status(403).json({ message: 'Community access denied' });
    const input = { ...req.body, communityKey: requestedCommunity };
    const payload = config.beforeCreate ? await config.beforeCreate(input) : input;
    const item = await config.model.create({ ...payload, createdBy: req.user.id });
    await writeAuditLog({
      req,
      action: 'record_created',
      resource: config.permissionResource,
      resourceId: item._id,
      newValue: item.toObject(),
      communityKey: item.communityKey,
    });
    return res.status(201).json({ message: 'Record created successfully', item });
  } catch (error) {
    console.error(`Error creating ${req.params.resource}:`, error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

router.patch('/:resource/:id', async (req, res) => {
  try {
    const config = resourceConfig[req.params.resource];
    if (!config) return res.status(404).json({ message: 'Resource not found' });

    await ensureDefaults(req.user.id);

    if (!getPermission(req.effectivePermissions, config.permissionResource, 'update'))
      return res
        .status(403)
        .json({ message: `Access denied: ${config.permissionResource}.update required` });

    if (req.user.role !== 'admin') {
      if (req.params.resource !== 'project-tasks' || req.user.role !== 'employee') {
        return res.status(403).json({ message: 'Access denied: Admins only' });
      }

      const employee = await User.findById(req.user.id).select('name email');
      if (!employee) return res.status(404).json({ message: 'Employee not found' });

      const payload = {};
      if (req.body.status !== undefined) {
        if (!taskStatuses.includes(req.body.status)) {
          return res.status(400).json({ message: 'Invalid task status' });
        }
        payload.status = req.body.status;
        if (req.body.status === 'Complete' && req.body.progress === undefined)
          payload.progress = 100;
      }
      if (req.body.progress !== undefined) {
        payload.progress = Math.max(0, Math.min(100, Number(req.body.progress) || 0));
      }

      if (!Object.keys(payload).length) {
        return res.status(400).json({ message: 'No allowed fields to update' });
      }

      const item = await BusinessProjectTask.findOneAndUpdate(
        {
          _id: req.params.id,
          ...buildAssignedTaskQuery(employee),
        },
        payload,
        {
          new: true,
          runValidators: true,
        },
      );

      if (!item) return res.status(404).json({ message: 'Task not found' });
      return res.json({ message: 'Task updated successfully', item });
    }

    const permission = getPermission(req.effectivePermissions, config.permissionResource, 'update');
    const scopeQuery = buildScopeQuery(req.user, permission.scope, req.selectedCommunity);
    const current = await config.model.findOne({ _id: req.params.id, ...scopeQuery });
    if (!current) return res.status(404).json({ message: 'Record not found in your access scope' });
    if (
      req.body.communityKey &&
      req.user.roleKey !== 'super_admin' &&
      !req.user.communities.includes(req.body.communityKey)
    )
      return res.status(403).json({ message: 'Community access denied' });
    const payload = config.beforeCreate ? await config.beforeCreate(req.body) : req.body;
    const item = await config.model.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });

    if (!item) return res.status(404).json({ message: 'Record not found' });
    await writeAuditLog({
      req,
      action: 'record_updated',
      resource: config.permissionResource,
      resourceId: item._id,
      previousValue: current.toObject(),
      newValue: item.toObject(),
      communityKey: item.communityKey,
    });
    return res.json({ message: 'Record updated successfully', item });
  } catch (error) {
    console.error(`Error updating ${req.params.resource}:`, error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

router.delete('/:resource/:id', async (req, res) => {
  try {
    const config = resourceConfig[req.params.resource];
    if (!config) return res.status(404).json({ message: 'Resource not found' });
    const permission = getPermission(req.effectivePermissions, config.permissionResource, 'delete');
    if (!permission)
      return res
        .status(403)
        .json({ message: `Access denied: ${config.permissionResource}.delete required` });

    await ensureDefaults(req.user.id);
    const scopeQuery = buildScopeQuery(req.user, permission.scope, req.selectedCommunity);
    const item = await config.model.findOneAndDelete({ _id: req.params.id, ...scopeQuery });
    if (!item) return res.status(404).json({ message: 'Record not found' });
    await writeAuditLog({
      req,
      action: 'record_deleted',
      resource: config.permissionResource,
      resourceId: item._id,
      previousValue: item.toObject(),
      communityKey: item.communityKey,
    });
    return res.json({ message: 'Record deleted successfully', id: req.params.id });
  } catch (error) {
    console.error(`Error deleting ${req.params.resource}:`, error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
