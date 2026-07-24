import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Building2,
  Check,
  ChevronRight,
  CircleGauge,
  Copy,
  Database,
  Eye,
  GitBranch,
  Grid3X3,
  LockKeyhole,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import PermissionPageTabs from '../components/permissions/PermissionPageTabs';
import BusinessUnitSelector from '../components/permissions/BusinessUnitSelector';
import ModulePermissionMatrix from '../components/permissions/ModulePermissionMatrix';
import {
  createDepartmentTeam,
  createRole,
  deleteDepartmentTeam,
  deleteRole,
  duplicateRole,
  getAccessUsers,
  getPermissionAudit,
  getPermissionMeta,
  getPermissionWorkspace,
  getRoles,
  previewAccess,
  updateDepartmentAccess,
  updateDepartmentTeam,
  updateRole,
} from '../services/accessApi';

const TABS = [
  { key: 'organization', label: 'Organization Access', icon: GitBranch },
  { key: 'roles', label: 'Roles', icon: ShieldCheck },
  { key: 'modules', label: 'Module Permissions', icon: Grid3X3 },
  { key: 'scope', label: 'Data Scope', icon: Database },
  { key: 'preview', label: 'Access Preview', icon: Eye },
];

const SCOPE_COPY = {
  OWN: 'Only records owned or created by the employee.',
  ASSIGNED: 'Only records assigned to the employee.',
  TEAM: 'Records belonging to the assigned team.',
  MULTIPLE_TEAMS: 'Records belonging to selected teams.',
  DEPARTMENT: 'All records in the assigned department.',
  BUSINESS_UNIT: 'All records in one assigned business unit.',
  MULTIPLE_BUSINESS_UNITS: 'Records across selected business units.',
  COMPANY: 'Complete company data.',
};

const roleKeyFromName = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
const ids = (values = []) => values.map((value) => String(value?._id || value));
const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-600';

const PermissionsHub = () => {
  const [activeTab, setActiveTab] = useState('organization');
  const [workspace, setWorkspace] = useState({
    businessUnits: [],
    departments: [],
    teams: [],
    modules: [],
    roles: [],
  });
  const [roles, setRoles] = useState([]);
  const [meta, setMeta] = useState({
    dataScopes: Object.keys(SCOPE_COPY),
    modules: [],
  });
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [departmentDraft, setDepartmentDraft] = useState(null);
  const [selectedRoleKey, setSelectedRoleKey] = useState('super_admin');
  const [roleDraft, setRoleDraft] = useState(null);
  const [teamModal, setTeamModal] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState('');
  const [teamForm, setTeamForm] = useState({
    name: '',
    businessUnitIds: [],
    isCompanyWide: false,
  });
  const [roleModal, setRoleModal] = useState(false);
  const [roleForm, setRoleForm] = useState({
    roleLabel: '',
    description: '',
    hierarchyLevel: 20,
    defaultDataScope: 'ASSIGNED',
  });
  const [previewForm, setPreviewForm] = useState({
    mode: 'role',
    roleKey: 'employee',
    userId: '',
    businessUnitId: '',
    departmentId: '',
    teamId: '',
  });
  const [preview, setPreview] = useState(null);

  const updateDepartmentDraft = (changes) =>
    setDepartmentDraft((current) => ({ ...current, ...changes }));
  const updateRoleDraft = (changes) => setRoleDraft((current) => ({ ...current, ...changes }));
  const updateTeamForm = (changes) => setTeamForm((current) => ({ ...current, ...changes }));
  const updateRoleForm = (changes) => setRoleForm((current) => ({ ...current, ...changes }));
  const updatePreviewForm = (changes) => setPreviewForm((current) => ({ ...current, ...changes }));

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [workspaceData, roleData, metaData, userData] = await Promise.all([
        getPermissionWorkspace(),
        getRoles(),
        getPermissionMeta(),
        getAccessUsers().catch(() => []),
      ]);
      setWorkspace(workspaceData);
      setRoles(roleData);
      setMeta(metaData);
      setUsers(userData);
      const department =
        workspaceData.departments.find((item) => item._id === selectedDepartmentId) ||
        workspaceData.departments[0];
      if (department) {
        setSelectedDepartmentId(department._id);
        setDepartmentDraft({
          ...department,
          businessUnitIds: ids(department.businessUnitIds),
          defaultModuleIds: department.defaultModuleIds || [],
        });
      }
      const role = roleData.find((item) => item.roleKey === selectedRoleKey) || roleData[0];
      if (role) {
        setSelectedRoleKey(role.roleKey);
        setRoleDraft({
          ...role,
          assignableBusinessUnitIds: ids(role.assignableBusinessUnitIds),
          assignableDepartmentIds: ids(role.assignableDepartmentIds),
          assignableTeamIds: ids(role.assignableTeamIds),
          permissions: role.permissions || [],
        });
      }
      getPermissionAudit()
        .then(setAudit)
        .catch(() => setAudit([]));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load access control');
    } finally {
      setLoading(false);
    }
  }, [selectedDepartmentId, selectedRoleKey]);

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedDepartment = workspace.departments.find(
    (item) => item._id === selectedDepartmentId,
  );
  const departmentTeams = workspace.teams.filter(
    (team) => String(team.departmentId?._id || team.departmentId) === selectedDepartmentId,
  );
  const selectedRole = roles.find((role) => role.roleKey === selectedRoleKey);
  const roleLocked = selectedRole?.roleKey === 'super_admin' || selectedRole?.locked;
  const departmentDirty =
    selectedDepartment &&
    departmentDraft &&
    JSON.stringify({ ...departmentDraft, updatedAt: undefined }) !==
      JSON.stringify({
        ...selectedDepartment,
        businessUnitIds: ids(selectedDepartment.businessUnitIds),
        defaultModuleIds: selectedDepartment.defaultModuleIds || [],
        updatedAt: undefined,
      });
  const roleDirty =
    selectedRole &&
    roleDraft &&
    JSON.stringify({
      ...roleDraft,
      updatedAt: undefined,
      userCount: undefined,
    }) !==
      JSON.stringify({
        ...selectedRole,
        assignableBusinessUnitIds: ids(selectedRole.assignableBusinessUnitIds),
        assignableDepartmentIds: ids(selectedRole.assignableDepartmentIds),
        assignableTeamIds: ids(selectedRole.assignableTeamIds),
        permissions: selectedRole.permissions || [],
        updatedAt: undefined,
        userCount: undefined,
      });

  useEffect(() => {
    const warn = (event) => {
      if (departmentDirty || roleDirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [departmentDirty, roleDirty]);

  const notify = (nextMessage, nextError = '') => {
    setMessage(nextMessage);
    setError(nextError);
  };

  const selectDepartment = (department) => {
    if (departmentDirty && !window.confirm('Discard unsaved department changes?')) return;
    setSelectedDepartmentId(department._id);
    setDepartmentDraft({
      ...department,
      businessUnitIds: ids(department.businessUnitIds),
      defaultModuleIds: department.defaultModuleIds || [],
    });
  };

  const saveDepartment = async () => {
    if (!departmentDraft.businessUnitIds.length)
      return setError('Select at least one Business Unit.');
    setSaving(true);
    try {
      const response = await updateDepartmentAccess(selectedDepartmentId, departmentDraft);
      setWorkspace((current) => ({
        ...current,
        departments: current.departments.map((item) =>
          item._id === response.department._id ? response.department : item,
        ),
      }));
      setDepartmentDraft({
        ...response.department,
        businessUnitIds: ids(response.department.businessUnitIds),
        defaultModuleIds: response.department.defaultModuleIds || [],
      });
      notify(response.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save department');
    } finally {
      setSaving(false);
    }
  };

  const addTeam = async (event) => {
    event.preventDefault();
    if (!teamForm.businessUnitIds.length)
      return setError('Select at least one Business Unit for the team.');
    setSaving(true);
    try {
      const response = editingTeamId
        ? await updateDepartmentTeam(editingTeamId, teamForm)
        : await createDepartmentTeam(selectedDepartmentId, teamForm);
      setWorkspace((current) => ({
        ...current,
        teams: editingTeamId
          ? current.teams.map((team) => (team._id === response.team._id ? response.team : team))
          : [...current.teams, response.team],
      }));
      setTeamModal(false);
      setEditingTeamId('');
      setTeamForm({ name: '', businessUnitIds: [], isCompanyWide: false });
      notify(response.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create team');
    } finally {
      setSaving(false);
    }
  };

  const removeTeam = async (team) => {
    if (!window.confirm(`Delete ${team.name}?`)) return;
    try {
      const response = await deleteDepartmentTeam(team._id);
      setWorkspace((current) => ({
        ...current,
        teams: current.teams.filter((item) => item._id !== team._id),
      }));
      notify(response.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete team');
    }
  };

  const selectRole = (role) => {
    if (roleDirty && !window.confirm('Discard unsaved role changes?')) return;
    setSelectedRoleKey(role.roleKey);
    setRoleDraft({
      ...role,
      assignableBusinessUnitIds: ids(role.assignableBusinessUnitIds),
      assignableDepartmentIds: ids(role.assignableDepartmentIds),
      assignableTeamIds: ids(role.assignableTeamIds),
      permissions: role.permissions || [],
    });
  };

  const saveRole = async () => {
    if (!roleDraft || roleLocked) return;
    setSaving(true);
    try {
      const payload = {
        ...roleDraft,
        defaultScope: roleDraft.defaultDataScope,
        permissions: roleDraft.permissions.map((permission) => ({
          ...permission,
          scope: roleDraft.defaultDataScope,
        })),
      };
      const response = await updateRole(roleDraft.roleKey, payload);
      const saved = {
        ...response.role,
        userCount: selectedRole.userCount || 0,
      };
      setRoles((current) => current.map((role) => (role.roleKey === saved.roleKey ? saved : role)));
      setRoleDraft({
        ...saved,
        assignableBusinessUnitIds: ids(saved.assignableBusinessUnitIds),
        assignableDepartmentIds: ids(saved.assignableDepartmentIds),
        assignableTeamIds: ids(saved.assignableTeamIds),
        permissions: saved.permissions || [],
      });
      notify(response.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save role');
    } finally {
      setSaving(false);
    }
  };

  const createCustom = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await createRole({
        ...roleForm,
        roleKey: roleKeyFromName(roleForm.roleLabel),
        defaultScope: roleForm.defaultDataScope,
        allowedUserTypes: ['employee'],
        permissions: [],
        active: true,
      });
      const created = { ...response.role, userCount: response.role.userCount || 0 };
      setRoles((current) => [
        ...current.filter((role) => role.roleKey !== created.roleKey),
        created,
      ]);
      setSelectedRoleKey(created.roleKey);
      setRoleDraft(created);
      setRoleModal(false);
      notify(response.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create role');
    } finally {
      setSaving(false);
    }
  };

  const duplicateSelected = async () => {
    const roleLabel = window.prompt(
      'Name for the duplicated role',
      `${selectedRole.roleLabel} Copy`,
    );
    if (!roleLabel) return;
    try {
      const response = await duplicateRole(selectedRole.roleKey, {
        roleLabel,
        roleKey: roleKeyFromName(roleLabel),
      });
      const created = { ...response.role, userCount: 0 };
      setRoles((current) => [...current, created]);
      selectRole(created);
      notify(response.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to duplicate role');
    }
  };

  const removeSelectedRole = async () => {
    if (!window.confirm(`Delete ${selectedRole.roleLabel}?`)) return;
    try {
      const response = await deleteRole(selectedRole.roleKey);
      notify(response.message);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete role');
    }
  };

  const runPreview = async () => {
    setSaving(true);
    try {
      const result = await previewAccess(
        previewForm.mode === 'user'
          ? { userId: previewForm.userId }
          : { roleKey: previewForm.roleKey },
      );
      setPreview(result);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to calculate access');
    } finally {
      setSaving(false);
    }
  };

  const filteredTeamsForPreview = workspace.teams.filter(
    (team) =>
      !previewForm.departmentId ||
      String(team.departmentId?._id || team.departmentId) === previewForm.departmentId,
  );

  if (loading)
    return (
      <div className="space-y-4">
        <div className="h-20 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-[34rem] animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );

  const OrganizationTab = () => (
    <div className="grid min-h-[40rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[18rem_1fr]">
      <aside className="border-b border-slate-200 bg-slate-50/70 lg:border-b-0 lg:border-r">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Organization</h2>
          <p className="mt-1 text-xs text-slate-500">Company → Business Unit → Department → Team</p>
        </div>
        <div className="p-2">
          <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Business Units
          </p>
          {workspace.businessUnits.map((unit) => (
            <div
              key={unit._id}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600"
            >
              <Building2 size={15} />
              {unit.name}
            </div>
          ))}
          <p className="mt-3 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Shared Departments
          </p>
          {workspace.departments.map((department) => (
            <button
              key={department._id}
              type="button"
              onClick={() => selectDepartment(department)}
              className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${selectedDepartmentId === department._id ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-white'}`}
            >
              <span>{department.name}</span>
              <ChevronRight size={14} />
            </button>
          ))}
        </div>
      </aside>
      {departmentDraft && (
        <main className="min-w-0">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-950">{departmentDraft.name}</h2>
                {departmentDraft.isCompanyWide && (
                  <span className="rounded-full bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700">
                    Shared company-wide department
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                One department mapped across selected Business Units.
              </p>
            </div>
            <button
              type="button"
              disabled={saving || !departmentDirty}
              onClick={saveDepartment}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              <Save size={16} />
              Save Changes
            </button>
          </div>
          <div className="space-y-6 p-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <label>
                <span className={labelClass}>Description</span>
                <textarea
                  rows="3"
                  value={departmentDraft.description}
                  onChange={(event) => updateDepartmentDraft({ description: event.target.value })}
                  className={`${inputClass} resize-none`}
                />
              </label>
              <div className="space-y-3">
                <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">Company-wide</span>
                    <span className="text-xs text-slate-500">Shared across the company</span>
                  </span>
                  <input
                    type="checkbox"
                    disabled={departmentDraft.slug === 'development'}
                    checked={departmentDraft.isCompanyWide}
                    onChange={(event) =>
                      updateDepartmentDraft({ isCompanyWide: event.target.checked })
                    }
                    className="h-5 w-5"
                  />
                </label>
                <select
                  value={departmentDraft.status}
                  onChange={(event) => updateDepartmentDraft({ status: event.target.value })}
                  className={inputClass}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <section>
              <h3 className="text-sm font-semibold text-slate-900">Available in Business Units</h3>
              <p className="mb-3 mt-1 text-xs text-slate-500">
                The department remains one shared record.
              </p>
              <BusinessUnitSelector
                businessUnits={workspace.businessUnits}
                selectedIds={departmentDraft.businessUnitIds}
                onChange={(businessUnitIds) => updateDepartmentDraft({ businessUnitIds })}
                disabled={departmentDraft.slug === 'development'}
              />
            </section>
            <section>
              <h3 className="text-sm font-semibold text-slate-900">Default CRM modules</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {workspace.modules.map((module) => {
                  const active = departmentDraft.defaultModuleIds.includes(module.moduleKey);
                  return (
                    <button
                      key={module.moduleKey}
                      type="button"
                      onClick={() =>
                        setDepartmentDraft((current) => ({
                          ...current,
                          defaultModuleIds: current.defaultModuleIds.includes(module.moduleKey)
                            ? current.defaultModuleIds.filter((key) => key !== module.moduleKey)
                            : [...current.defaultModuleIds, module.moduleKey],
                        }))
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500'}`}
                    >
                      {module.label}
                    </button>
                  );
                })}
              </div>
            </section>
            <section>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Department teams</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Teams may be specific, shared or company-wide.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTeamId('');
                    setTeamForm({
                      name: '',
                      businessUnitIds: departmentDraft.businessUnitIds,
                      isCompanyWide: departmentDraft.isCompanyWide,
                    });
                    setTeamModal(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700"
                >
                  <Plus size={14} />
                  New Team
                </button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {departmentTeams.map((team) => (
                  <div
                    key={team._id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{team.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {team.businessUnitIds.length} Business Unit
                        {team.businessUnitIds.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <span className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTeamId(team._id);
                          setTeamForm({
                            name: team.name,
                            businessUnitIds: ids(team.businessUnitIds),
                            isCompanyWide: team.isCompanyWide,
                          });
                          setTeamModal(true);
                        }}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                        aria-label={`Edit ${team.name}`}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTeam(team)}
                        className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                        aria-label={`Delete ${team.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </section>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Assigned employees</p>
                <p className="mt-1 text-xl font-semibold">{departmentDraft.employeeCount || 0}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Assigned managers</p>
                <p className="mt-1 text-xl font-semibold">{departmentDraft.managerCount || 0}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Role hierarchy</p>
                <p className="mt-1 text-sm font-semibold">Head → Manager → Lead → Employee</p>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );

  const RoleList = () => (
    <aside className="border-b border-slate-200 bg-slate-50/70 lg:border-b-0 lg:border-r">
      <div className="border-b border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Roles</h2>
        <p className="mt-1 text-xs text-slate-500">{roles.length} system and custom roles</p>
      </div>
      <div className="max-h-[42rem] space-y-1 overflow-y-auto p-2">
        {roles.map((role) => (
          <button
            key={role.roleKey}
            type="button"
            onClick={() => selectRole(role)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${selectedRoleKey === role.roleKey ? 'bg-blue-600 text-white' : 'hover:bg-white'}`}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${selectedRoleKey === role.roleKey ? 'bg-white/15' : 'bg-white text-blue-700'}`}
            >
              {role.locked ? <LockKeyhole size={14} /> : <ShieldCheck size={14} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{role.roleLabel}</span>
              <span
                className={`block text-[11px] ${selectedRoleKey === role.roleKey ? 'text-blue-100' : 'text-slate-400'}`}
              >
                Level {role.hierarchyLevel} · {role.systemRole ? 'System' : 'Custom'} ·{' '}
                {role.userCount || 0} users
              </span>
            </span>
          </button>
        ))}
      </div>
    </aside>
  );

  const RolesTab = () => (
    <div className="grid min-h-[40rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[19rem_1fr]">
      {RoleList()}
      {roleDraft && (
        <main>
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">{roleDraft.roleLabel}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {roleDraft.systemRole ? 'System role' : 'Custom role'} · hierarchy level{' '}
                {roleDraft.hierarchyLevel}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={duplicateSelected}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                <Copy size={15} />
                Duplicate
              </button>
              {!roleDraft.systemRole && (
                <button
                  type="button"
                  onClick={removeSelectedRole}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600"
                >
                  <Trash2 size={15} />
                  Delete
                </button>
              )}
              <button
                type="button"
                disabled={saving || roleLocked || !roleDirty}
                onClick={saveRole}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                <Save size={15} />
                Save
              </button>
            </div>
          </div>
          <div className="space-y-6 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className={labelClass}>Role name</span>
                <input
                  disabled={roleDraft.systemRole}
                  value={roleDraft.roleLabel}
                  onChange={(event) => updateRoleDraft({ roleLabel: event.target.value })}
                  className={inputClass}
                />
              </label>
              <label>
                <span className={labelClass}>Hierarchy level</span>
                <input
                  type="number"
                  min="0"
                  max="99"
                  disabled={roleDraft.systemRole}
                  value={roleDraft.hierarchyLevel}
                  onChange={(event) =>
                    updateRoleDraft({ hierarchyLevel: Number(event.target.value) })
                  }
                  className={inputClass}
                />
              </label>
            </div>
            <label className="block">
              <span className={labelClass}>Description</span>
              <textarea
                rows="2"
                disabled={roleLocked}
                value={roleDraft.description}
                onChange={(event) => updateRoleDraft({ description: event.target.value })}
                className={`${inputClass} resize-none`}
              />
            </label>
            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">
                Assignable Business Units
              </h3>
              <BusinessUnitSelector
                businessUnits={workspace.businessUnits}
                selectedIds={roleDraft.assignableBusinessUnitIds}
                onChange={(assignableBusinessUnitIds) =>
                  updateRoleDraft({ assignableBusinessUnitIds })
                }
                disabled={roleLocked}
              />
            </section>
            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Assignable Departments</h3>
              <div className="flex flex-wrap gap-2">
                {workspace.departments.map((department) => {
                  const active = roleDraft.assignableDepartmentIds.includes(department._id);
                  return (
                    <button
                      key={department._id}
                      type="button"
                      disabled={roleLocked}
                      onClick={() =>
                        setRoleDraft((current) => ({
                          ...current,
                          assignableDepartmentIds: current.assignableDepartmentIds.includes(
                            department._id,
                          )
                            ? current.assignableDepartmentIds.filter((id) => id !== department._id)
                            : [...current.assignableDepartmentIds, department._id],
                        }))
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500'}`}
                    >
                      {department.name}
                    </button>
                  );
                })}
              </div>
            </section>
            <label className="block max-w-md">
              <span className={labelClass}>Default data scope</span>
              <select
                disabled={roleLocked}
                value={roleDraft.defaultDataScope}
                onChange={(event) => updateRoleDraft({ defaultDataScope: event.target.value })}
                className={inputClass}
              >
                {meta.dataScopes.map((scope) => (
                  <option key={scope} value={scope}>
                    {scope.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Module permission summary</p>
              <p className="mt-1 text-sm text-slate-500">
                {roleDraft.permissions.length} resources configured. Use the Module Permissions tab
                for detailed actions.
              </p>
            </div>
          </div>
        </main>
      )}
    </div>
  );

  const ModulesTab = () => (
    <div className="grid min-h-[40rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[19rem_1fr]">
      {RoleList()}
      {roleDraft && (
        <main className="min-w-0">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                {roleDraft.roleLabel} module permissions
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Actions and data visibility are configured separately.
              </p>
            </div>
            <button
              type="button"
              disabled={saving || roleLocked || !roleDirty}
              onClick={saveRole}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              <Save size={15} />
              Save Permissions
            </button>
          </div>
          <div className="p-5">
            <ModulePermissionMatrix
              modules={workspace.modules}
              permissions={roleDraft.permissions}
              onChange={(permissions) => updateRoleDraft({ permissions })}
              locked={roleLocked}
            />
          </div>
        </main>
      )}
    </div>
  );

  const ScopeTab = () => (
    <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Choose role
        </p>
        {roles.map((role) => (
          <button
            key={role.roleKey}
            type="button"
            onClick={() => selectRole(role)}
            className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${selectedRoleKey === role.roleKey ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
          >
            {role.roleLabel}
          </button>
        ))}
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Default data scope</h2>
            <p className="mt-1 text-sm text-slate-500">
              Defines which records {roleDraft?.roleLabel} can see. Actions remain separate.
            </p>
          </div>
          <button
            type="button"
            disabled={roleLocked || !roleDirty || saving}
            onClick={saveRole}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            <Save size={15} />
            Save Scope
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {meta.dataScopes.map((scope) => {
            const active = roleDraft?.defaultDataScope === scope;
            return (
              <button
                key={scope}
                type="button"
                disabled={roleLocked}
                onClick={() => updateRoleDraft({ defaultDataScope: scope })}
                className={`rounded-xl border p-4 text-left ${active ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-200'}`}
              >
                <span className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">
                    {scope.replaceAll('_', ' ')}
                  </span>
                  {active && <Check size={16} className="text-blue-700" />}
                </span>
                <span className="mt-2 block text-xs leading-5 text-slate-500">
                  {SCOPE_COPY[scope]}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );

  const PreviewTab = () => (
    <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">Permission simulator</h2>
        <p className="mt-1 text-xs text-slate-500">Read-only effective access calculation.</p>
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => updatePreviewForm({ mode: 'role' })}
              className={`rounded-md py-2 text-xs font-semibold ${previewForm.mode === 'role' ? 'bg-white shadow-sm' : ''}`}
            >
              By role
            </button>
            <button
              type="button"
              onClick={() => updatePreviewForm({ mode: 'user' })}
              className={`rounded-md py-2 text-xs font-semibold ${previewForm.mode === 'user' ? 'bg-white shadow-sm' : ''}`}
            >
              By user
            </button>
          </div>
          {previewForm.mode === 'role' ? (
            <label>
              <span className={labelClass}>Role</span>
              <select
                value={previewForm.roleKey}
                onChange={(event) => updatePreviewForm({ roleKey: event.target.value })}
                className={inputClass}
              >
                {roles.map((role) => (
                  <option key={role.roleKey} value={role.roleKey}>
                    {role.roleLabel}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              <span className={labelClass}>User</span>
              <select
                value={previewForm.userId}
                onChange={(event) => updatePreviewForm({ userId: event.target.value })}
                className={inputClass}
              >
                <option value="">Select user</option>
                {users.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.name} · {user.email}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span className={labelClass}>Business Unit context</span>
            <select
              value={previewForm.businessUnitId}
              onChange={(event) => updatePreviewForm({ businessUnitId: event.target.value })}
              className={inputClass}
            >
              <option value="">All allowed</option>
              {workspace.businessUnits.map((unit) => (
                <option key={unit._id} value={unit._id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>Department context</span>
            <select
              value={previewForm.departmentId}
              onChange={(event) =>
                updatePreviewForm({ departmentId: event.target.value, teamId: '' })
              }
              className={inputClass}
            >
              <option value="">All allowed</option>
              {workspace.departments.map((department) => (
                <option key={department._id} value={department._id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>Team context</span>
            <select
              value={previewForm.teamId}
              onChange={(event) => updatePreviewForm({ teamId: event.target.value })}
              className={inputClass}
            >
              <option value="">All allowed</option>
              {filteredTeamsForPreview.map((team) => (
                <option key={team._id} value={team._id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={saving || (previewForm.mode === 'user' && !previewForm.userId)}
            onClick={runPreview}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Calculate Effective Access
          </button>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {!preview ? (
          <div className="flex min-h-96 flex-col items-center justify-center text-center">
            <CircleGauge size={32} className="text-slate-300" />
            <h3 className="mt-4 text-sm font-semibold text-slate-700">
              Select context and calculate
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              No permissions are assumed. Missing permission means denied.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Effective access</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {preview.bypass
                    ? 'Super Admin bypass active'
                    : `${preview.permissions?.length || 0} resource permissions resolved`}
                </p>
              </div>
              {preview.conflicts?.length > 0 && (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  {preview.conflicts.length} conflict(s)
                </span>
              )}
            </div>
            <div className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Visible sidebar modules
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {preview.visibleModules?.map((module) => (
                  <span
                    key={module}
                    className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
                  >
                    {module.replaceAll('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-5 max-h-80 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Resource</th>
                    <th className="px-3 py-2">Actions</th>
                    <th className="px-3 py-2">Scope / Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.permissions?.map((permission) => (
                    <tr key={permission.resource}>
                      <td className="px-3 py-2 font-semibold text-slate-800">
                        {permission.resource}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{permission.actions?.join(', ')}</td>
                      <td className="px-3 py-2 text-slate-500">
                        {(permission.scopes || [permission.scope || preview.dataScope]).join(', ')}
                        <span className="block text-[10px]">
                          {(permission.sources || [permission.source]).filter(Boolean).join(' · ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );

  return (
    <div className="mx-auto max-w-[96rem] space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            Access control
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Permissions</h1>
          <p className="mt-1 text-sm text-slate-500">
            Business Units, shared departments, roles, module actions and data scope in one place.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAuditOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            <Activity size={16} />
            Recent Activity
          </button>
          <button
            type="button"
            onClick={() => {
              setError('');
              setRoleForm({
                roleLabel: '',
                description: '',
                hierarchyLevel: 20,
                defaultDataScope: 'ASSIGNED',
              });
              setRoleModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Plus size={16} />
            New Custom Role
          </button>
        </div>
      </header>
      {(message || error) && (
        <div
          className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
        >
          <span>{error || message}</span>
          <button
            type="button"
            onClick={() => {
              setMessage('');
              setError('');
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <PermissionPageTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      {activeTab === 'organization' && OrganizationTab()}
      {activeTab === 'roles' && RolesTab()}
      {activeTab === 'modules' && ModulesTab()}
      {activeTab === 'scope' && ScopeTab()}
      {activeTab === 'preview' && PreviewTab()}

      {teamModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4">
          <form onSubmit={addTeam} className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold">
                {editingTeamId ? 'Edit' : 'New'} {departmentDraft?.name} Team
              </h2>
              <button type="button" onClick={() => setTeamModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 p-5">
              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {error}
                </p>
              )}
              <label>
                <span className={labelClass}>Team name</span>
                <input
                  required
                  autoFocus
                  value={teamForm.name}
                  onChange={(event) => updateTeamForm({ name: event.target.value })}
                  className={inputClass}
                />
              </label>
              <fieldset>
                <legend className="mb-2 text-xs font-semibold text-slate-600">
                  Business Units
                </legend>
                <BusinessUnitSelector
                  businessUnits={workspace.businessUnits.filter((unit) =>
                    departmentDraft.businessUnitIds.includes(unit._id),
                  )}
                  selectedIds={teamForm.businessUnitIds}
                  onChange={(businessUnitIds) => updateTeamForm({ businessUnitIds })}
                />
              </fieldset>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={teamForm.isCompanyWide}
                  onChange={(event) => updateTeamForm({ isCompanyWide: event.target.checked })}
                />
                Company-wide team
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setTeamModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              >
                {editingTeamId ? 'Save Team' : 'Create Team'}
              </button>
            </div>
          </form>
        </div>
      )}
      {roleModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4">
          <form onSubmit={createCustom} className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold">New Custom Role</h2>
              <button type="button" onClick={() => setRoleModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <label>
                <span className={labelClass}>Role name</span>
                <input
                  required
                  autoFocus
                  value={roleForm.roleLabel}
                  onChange={(event) => updateRoleForm({ roleLabel: event.target.value })}
                  className={inputClass}
                />
              </label>
              <label>
                <span className={labelClass}>Description</span>
                <textarea
                  rows="2"
                  value={roleForm.description}
                  onChange={(event) => updateRoleForm({ description: event.target.value })}
                  className={`${inputClass} resize-none`}
                />
              </label>
              <label>
                <span className={labelClass}>Default data scope</span>
                <select
                  value={roleForm.defaultDataScope}
                  onChange={(event) => updateRoleForm({ defaultDataScope: event.target.value })}
                  className={inputClass}
                >
                  {meta.dataScopes.map((scope) => (
                    <option key={scope} value={scope}>
                      {scope.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setRoleModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Create Role
              </button>
            </div>
          </form>
        </div>
      )}
      {auditOpen && (
        <div
          className="fixed inset-0 z-[95] bg-slate-950/30"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAuditOpen(false);
          }}
        >
          <aside className="ml-auto flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-5">
              <div>
                <h2 className="text-lg font-semibold">Permission Activity</h2>
                <p className="mt-1 text-xs text-slate-500">Latest access-control changes</p>
              </div>
              <button type="button" onClick={() => setAuditOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {audit.map((entry) => (
                <div key={entry._id} className="rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    {entry.action.replaceAll('_', ' ')}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {entry.actorUserId?.name || 'System'} · {entry.resource}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-400">
                    {new Date(entry.createdAt).toLocaleString('en-IN')}
                  </p>
                </div>
              ))}
              {!audit.length && (
                <p className="py-16 text-center text-sm text-slate-500">
                  No permission activity yet.
                </p>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default PermissionsHub;
