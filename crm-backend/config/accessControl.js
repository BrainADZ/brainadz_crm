const ACTIONS = [
  'view',
  'create',
  'update',
  'delete',
  'assign',
  'import',
  'approve',
  'reject',
  'comment',
  'upload',
  'download',
  'export',
  'manage',
  'reopen',
  'close',
];
const DATA_SCOPES = [
  'OWN',
  'ASSIGNED',
  'TEAM',
  'MULTIPLE_TEAMS',
  'DEPARTMENT',
  'BUSINESS_UNIT',
  'MULTIPLE_BUSINESS_UNITS',
  'COMPANY',
];
const LEGACY_SCOPES = [
  'all',
  'community',
  'department',
  'team',
  'assigned',
  'self',
  'linked',
  'none',
];
const SCOPES = [...LEGACY_SCOPES, ...DATA_SCOPES];
const USER_TYPES = ['employee', 'client', 'vendor', 'contractor'];
const ACCOUNT_STATUSES = ['invited', 'active', 'suspended', 'inactive'];

const PERMISSION_RESOURCES = [
  'dashboard',
  'business_os',
  'sales_crm',
  'leads',
  'clients',
  'follow_ups',
  'proposals',
  'pipelines',
  'communication',
  'marketing',
  'campaigns',
  'accounting',
  'quotations',
  'invoices',
  'payments',
  'expenses',
  'projects',
  'tasks',
  'team_workload',
  'daily_reports',
  'attendance',
  'leave',
  'documents',
  'employee_documents',
  'employees',
  'employee_profiles',
  'employee_salary',
  'users',
  'teams',
  'meetings',
  'permissions',
  'roles',
  'settings',
  'whatsapp',
  'vendors',
  'reports',
  'audit_logs',
  'reimbursements',
  'financial_profitability',
  'password_reset',
  'user_activation',
  'permission_management',
];

const MODULES = [
  { key: 'dashboard', label: 'Dashboard', resources: ['dashboard'] },
  { key: 'business_os', label: 'Business OS', resources: ['business_os'] },
  { key: 'sales', label: 'Sales / Clients', resources: ['leads'] },
  { key: 'quotations', label: 'Quotations', resources: ['quotations'] },
  { key: 'communication', label: 'Communication', resources: ['communication'] },
  { key: 'marketing', label: 'Marketing', resources: ['campaigns'] },
  { key: 'accounting', label: 'Accounting', resources: ['accounting'] },
  { key: 'projects', label: 'Project Work', resources: ['projects', 'tasks'] },
  { key: 'documents', label: 'Documents', resources: ['documents'] },
  { key: 'employees', label: 'Employees', resources: ['employees'] },
  { key: 'meetings', label: 'Meetings', resources: ['meetings'] },
  { key: 'whatsapp', label: 'WhatsApp', resources: ['whatsapp'] },
  { key: 'permissions', label: 'Permissions', resources: ['permissions', 'roles', 'audit_logs'] },
];

const UNIVERSAL_COMMUNITIES = [
  { key: 'marketing', name: 'BrainADZ Marketing', universal: true, locked: true },
  { key: 'live', name: 'BrainADZ Live', universal: true, locked: true },
  { key: 'exhibition', name: 'BrainADZ Exhibits', universal: true, locked: true },
];

const DEPARTMENT_SEEDS = [
  {
    name: 'Marketing',
    slug: 'marketing',
    icon: 'Megaphone',
    businessUnitKeys: ['marketing', 'live', 'exhibition'],
  },
  {
    name: 'Creative',
    slug: 'creative',
    icon: 'Palette',
    businessUnitKeys: ['marketing', 'live', 'exhibition'],
  },
  {
    name: 'Development',
    slug: 'development',
    icon: 'Code2',
    isCompanyWide: true,
    businessUnitKeys: ['marketing', 'live', 'exhibition'],
  },
  { name: '3D Team', slug: '3d-team', icon: 'Box', businessUnitKeys: ['exhibition'] },
  {
    name: 'Accounts',
    slug: 'accounts',
    icon: 'ReceiptText',
    businessUnitKeys: ['marketing', 'live', 'exhibition'],
  },
  {
    name: 'HR',
    slug: 'hr',
    icon: 'UsersRound',
    businessUnitKeys: ['marketing', 'live', 'exhibition'],
  },
  {
    name: 'Sales',
    slug: 'sales',
    icon: 'Handshake',
    businessUnitKeys: ['marketing', 'live', 'exhibition'],
  },
  {
    name: 'Vendors',
    slug: 'vendors',
    icon: 'Truck',
    businessUnitKeys: ['marketing', 'live', 'exhibition'],
  },
  { name: 'Production', slug: 'production', icon: 'Factory', businessUnitKeys: ['exhibition'] },
];

const allPermission = (resource, scope = 'COMPANY') => ({ resource, actions: [...ACTIONS], scope });
const selectedPermissions = (resources, actions, scope) =>
  resources.map((resource) => ({ resource, actions, scope }));
const operationalResources = PERMISSION_RESOURCES.filter(
  (resource) =>
    !['permissions', 'roles', 'permission_management', 'audit_logs', 'employee_salary'].includes(
      resource,
    ),
);

const ROLE_TEMPLATES = [
  {
    roleKey: 'super_admin',
    roleLabel: 'Super Admin',
    hierarchyLevel: 100,
    description: 'Locked complete company access.',
    defaultDataScope: 'COMPANY',
    defaultScope: 'COMPANY',
    locked: true,
    systemRole: true,
    allowedUserTypes: USER_TYPES,
    permissions: PERMISSION_RESOURCES.map((resource) => allPermission(resource)),
  },
  {
    roleKey: 'company_admin',
    roleLabel: 'Company Admin',
    hierarchyLevel: 90,
    description: 'Full company operations except Super Admin control.',
    defaultDataScope: 'COMPANY',
    defaultScope: 'COMPANY',
    systemRole: true,
    allowedUserTypes: ['employee'],
    permissions: [
      ...operationalResources.map((resource) => allPermission(resource)),
      ...selectedPermissions(
        ['permissions', 'roles', 'permission_management', 'audit_logs'],
        ['view', 'create', 'update', 'assign', 'export', 'manage'],
        'COMPANY',
      ),
    ],
  },
  {
    roleKey: 'business_unit_head',
    roleLabel: 'Business Unit Head',
    hierarchyLevel: 80,
    description: 'Full access inside assigned business units.',
    defaultDataScope: 'MULTIPLE_BUSINESS_UNITS',
    defaultScope: 'MULTIPLE_BUSINESS_UNITS',
    systemRole: true,
    allowedUserTypes: ['employee'],
    permissions: selectedPermissions(
      operationalResources,
      ACTIONS.filter((action) => action !== 'manage'),
      'MULTIPLE_BUSINESS_UNITS',
    ),
  },
  {
    roleKey: 'department_head',
    roleLabel: 'Department Head',
    hierarchyLevel: 70,
    description: 'Manages an assigned department and its teams.',
    defaultDataScope: 'DEPARTMENT',
    defaultScope: 'DEPARTMENT',
    systemRole: true,
    allowedUserTypes: ['employee'],
    permissions: selectedPermissions(
      operationalResources,
      ACTIONS.filter((action) => !['delete', 'manage'].includes(action)),
      'DEPARTMENT',
    ),
  },
  {
    roleKey: 'senior_manager',
    roleLabel: 'Senior Manager',
    hierarchyLevel: 60,
    description: 'Manages multiple assigned teams.',
    defaultDataScope: 'MULTIPLE_TEAMS',
    defaultScope: 'MULTIPLE_TEAMS',
    systemRole: true,
    allowedUserTypes: ['employee'],
    permissions: selectedPermissions(
      operationalResources,
      ['view', 'create', 'update', 'assign', 'approve', 'comment', 'upload', 'download', 'export'],
      'MULTIPLE_TEAMS',
    ),
  },
  {
    roleKey: 'manager',
    roleLabel: 'Manager',
    hierarchyLevel: 50,
    description: 'Manages assigned teams and team data.',
    defaultDataScope: 'TEAM',
    defaultScope: 'TEAM',
    systemRole: true,
    allowedUserTypes: ['employee'],
    permissions: selectedPermissions(
      operationalResources,
      ['view', 'create', 'update', 'assign', 'approve', 'comment', 'upload', 'download'],
      'TEAM',
    ),
  },
  {
    roleKey: 'team_lead',
    roleLabel: 'Team Lead',
    hierarchyLevel: 40,
    description: 'Coordinates daily work for an assigned team.',
    defaultDataScope: 'TEAM',
    defaultScope: 'TEAM',
    systemRole: true,
    allowedUserTypes: ['employee'],
    permissions: selectedPermissions(
      operationalResources,
      ['view', 'create', 'update', 'assign', 'comment', 'upload', 'download'],
      'TEAM',
    ),
  },
  {
    roleKey: 'employee',
    roleLabel: 'Employee',
    hierarchyLevel: 10,
    description: 'Own and assigned work only.',
    defaultDataScope: 'ASSIGNED',
    defaultScope: 'ASSIGNED',
    systemRole: true,
    allowedUserTypes: ['employee'],
    permissions: selectedPermissions(
      ['dashboard', 'projects', 'tasks', 'daily_reports', 'documents', 'meetings', 'settings'],
      ['view', 'create', 'update', 'comment', 'upload', 'download'],
      'ASSIGNED',
    ),
  },
  {
    roleKey: 'custom_role',
    roleLabel: 'Custom Role',
    hierarchyLevel: 20,
    description: 'Configurable role created by Super Admin.',
    defaultDataScope: 'ASSIGNED',
    defaultScope: 'ASSIGNED',
    systemRole: true,
    allowedUserTypes: USER_TYPES,
    permissions: [],
  },
];

const DEFAULT_ROLES = ROLE_TEMPLATES;
const CRM_ROLE_KEYS = ROLE_TEMPLATES.map((role) => role.roleKey);
const COMMUNITY_KEYS = UNIVERSAL_COMMUNITIES.map((community) => community.key);

module.exports = {
  ACTIONS,
  DATA_SCOPES,
  SCOPES,
  USER_TYPES,
  ACCOUNT_STATUSES,
  PERMISSION_RESOURCES,
  MODULES,
  UNIVERSAL_COMMUNITIES,
  DEPARTMENT_SEEDS,
  ROLE_TEMPLATES,
  DEFAULT_ROLES,
  CRM_ROLE_KEYS,
  COMMUNITY_KEYS,
};
