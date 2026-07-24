export type PermissionAction =
  'view' | 'create' | 'update' | 'delete' | 'assign' | 'import' | 'approve' | 'export' | 'manage';
export type DataScope =
  | 'OWN'
  | 'ASSIGNED'
  | 'TEAM'
  | 'MULTIPLE_TEAMS'
  | 'DEPARTMENT'
  | 'BUSINESS_UNIT'
  | 'MULTIPLE_BUSINESS_UNITS'
  | 'COMPANY';
export type EntityStatus = 'active' | 'inactive';

export interface BusinessUnit {
  _id: string;
  name: string;
  slug: string;
  status: EntityStatus;
}
export interface Department {
  _id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  status: EntityStatus;
  isCompanyWide: boolean;
  businessUnitIds: string[];
  defaultModuleIds: string[];
  employeeCount: number;
  managerCount: number;
}
export interface Team {
  _id: string;
  name: string;
  departmentId: string;
  businessUnitIds: string[];
  isCompanyWide: boolean;
  status: EntityStatus;
  managerUserId?: string;
  seniorManagerUserId?: string;
  teamLeadUserId?: string;
}
export interface ModulePermission {
  resource: string;
  actions: PermissionAction[];
  scope: DataScope;
}
export interface Role {
  _id: string;
  roleKey: string;
  roleLabel: string;
  description: string;
  hierarchyLevel: number;
  systemRole: boolean;
  locked: boolean;
  active: boolean;
  defaultDataScope: DataScope;
  assignableBusinessUnitIds: string[];
  assignableDepartmentIds: string[];
  assignableTeamIds: string[];
  permissions: ModulePermission[];
  userCount: number;
}
export interface UserAccessAssignment {
  _id: string;
  userId: string;
  roleId: string;
  businessUnitIds: string[];
  departmentId: string;
  teamIds: string[];
  dataScope: DataScope;
  modulePermissionOverrides: Array<{
    resource: string;
    allow: PermissionAction[];
    deny: PermissionAction[];
  }>;
  isPrimary: boolean;
  status: string;
  startDate: string;
  endDate?: string;
}
export interface EffectivePermission {
  resource: string;
  actions: PermissionAction[];
  deniedActions: PermissionAction[];
  scopes: DataScope[];
  sources: string[];
}
