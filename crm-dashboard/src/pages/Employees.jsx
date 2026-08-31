import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Check,
  ChevronDown,
  KeyRound,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react';
import PasswordInput from '../components/PasswordInput';
import { getPermissionWorkspace } from '../services/accessApi';
import {
  createEmployeeWithAccess,
  deleteEmployee,
  getEmployeeDirectory,
  updateEmployeeWithAccess,
} from '../services/employeeApi';

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
const DATA_SCOPE_RANK = Object.fromEntries(DATA_SCOPES.map((scope, index) => [scope, index + 1]));
const blankPersonal = {
  name: '',
  email: '',
  phone: '',
  password: '',
  position: '',
  employmentType: 'full_time',
  joiningDate: new Date().toISOString().slice(0, 10),
  workLocation: '',
  address: '',
  emergencyContact: '',
};
const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-600';
const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'EM';
const idOf = (value) => String(value?._id || value || '');
const roleFitsAssignment = (role, departmentId, businessUnitIds = []) => {
  if (
    role.active === false ||
    role.roleKey === 'super_admin' ||
    !role.allowedUserTypes?.includes('employee')
  )
    return false;
  const departmentIds = (role.assignableDepartmentIds || []).map(idOf);
  const unitIds = (role.assignableBusinessUnitIds || []).map(idOf);
  return (
    (!departmentIds.length || departmentIds.includes(departmentId)) &&
    (!unitIds.length || businessUnitIds.every((id) => unitIds.includes(id)))
  );
};

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [workspace, setWorkspace] = useState({
    businessUnits: [],
    departments: [],
    teams: [],
    roles: [],
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [personal, setPersonal] = useState(blankPersonal);
  const [assignments, setAssignments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const updatePersonal = (field, value) =>
    setPersonal((current) => ({
      ...current,
      [field]: value,
    }));

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [employeeData, workspaceData] = await Promise.all([
        getEmployeeDirectory(),
        getPermissionWorkspace(),
      ]);
      setEmployees(employeeData);
      setWorkspace(workspaceData);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load employee directory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const newAssignment = useCallback(
    (primary = false) => {
      const department = workspace.departments[0];
      const businessUnitIds = department?.businessUnitIds?.slice(0, 1).map(idOf) || [];
      const role =
        workspace.roles.find((item) => item.roleKey === 'employee') ||
        workspace.roles.find((item) => item.roleKey !== 'super_admin');
      return {
        businessUnitIds,
        departmentId: department?._id || '',
        teamIds: [],
        roleId: role?._id || '',
        dataScope: role?.defaultDataScope || 'ASSIGNED',
        isPrimary: primary,
      };
    },
    [workspace],
  );

  const openAdd = () => {
    setEditingEmployee(null);
    setPersonal(blankPersonal);
    setAssignments([newAssignment(true)]);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (employee) => {
    setEditingEmployee(employee);
    setPersonal({
      name: employee.name || '',
      email: employee.email || '',
      phone: employee.phone || '',
      password: '',
      position: employee.position || '',
      employmentType: employee.employmentType || 'full_time',
      joiningDate: employee.joiningDate
        ? new Date(employee.joiningDate).toISOString().slice(0, 10)
        : '',
      workLocation: employee.workLocation || '',
      address: employee.address || '',
      emergencyContact: employee.emergencyContact || '',
    });
    const mappedAssignments = (employee.accessAssignments || []).map((assignment) => ({
      businessUnitIds: assignment.businessUnitIds.map(idOf),
      departmentId: idOf(assignment.departmentId),
      teamIds: assignment.teamIds.map(idOf),
      roleId: idOf(assignment.roleId),
      dataScope: assignment.dataScope,
      isPrimary: Boolean(assignment.isPrimary),
    }));
    setAssignments(mappedAssignments.length ? mappedAssignments : [newAssignment(true)]);
    setError('');
    setModalOpen(true);
  };

  const updateAssignment = (index, changes) =>
    setAssignments((current) =>
      current.map((assignment, rowIndex) =>
        rowIndex === index ? { ...assignment, ...changes } : assignment,
      ),
    );
  const removeAssignment = (index) =>
    setAssignments((current) => {
      const next = current.filter((_, rowIndex) => rowIndex !== index);
      if (next.length && !next.some((item) => item.isPrimary))
        next[0] = { ...next[0], isPrimary: true };
      return next;
    });
  const setPrimary = (index) =>
    setAssignments((current) =>
      current.map((assignment, rowIndex) => ({ ...assignment, isPrimary: rowIndex === index })),
    );

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!/^\+?\d{10,12}$/.test(personal.phone.replace(/[\s-]/g, '')))
      return setError('Enter a valid 10-digit phone number.');
    if (!editingEmployee && personal.password.length < 8)
      return setError('Password must be at least 8 characters.');
    if (editingEmployee && personal.password && personal.password.length < 8)
      return setError('New password must be at least 8 characters.');
    if (!assignments.length) return setError('Add at least one access assignment.');
    if (
      assignments.some(
        (assignment) =>
          !assignment.businessUnitIds.length ||
          !assignment.departmentId ||
          !assignment.roleId ||
          !assignment.dataScope,
      )
    )
      return setError('Complete every access assignment row.');
    setSaving(true);
    try {
      const response = editingEmployee
        ? await updateEmployeeWithAccess(editingEmployee._id, { ...personal, assignments })
        : await createEmployeeWithAccess({ ...personal, assignments });
      setMessage(response.message);
      setModalOpen(false);
      await load();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          `Unable to ${editingEmployee ? 'update' : 'create'} employee`,
      );
    } finally {
      setSaving(false);
    }
  };

  const removeEmployee = async (employee) => {
    if (
      !window.confirm(
        `Delete ${employee.name}? Their login will be disabled, but historical records will remain.`,
      )
    )
      return;
    setError('');
    try {
      const response = await deleteEmployee(employee._id);
      setEmployees((current) => current.filter((item) => item._id !== employee._id));
      setMessage(response.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete employee');
    }
  };

  const filtered = useMemo(
    () =>
      employees.filter((employee) => {
        const query = search.trim().toLowerCase();
        const assignmentsList = employee.accessAssignments || [];
        const matchesSearch =
          !query ||
          [
            employee.name,
            employee.email,
            employee.employeeId,
            employee.phone,
            employee.position,
            ...assignmentsList.flatMap((assignment) => [
              assignment.departmentId?.name,
              assignment.roleId?.roleLabel,
              ...assignment.businessUnitIds.map((unit) => unit.name),
            ]),
          ].some((value) =>
            String(value || '')
              .toLowerCase()
              .includes(query),
          );
        const matchesDepartment =
          departmentFilter === 'all' ||
          assignmentsList.some((assignment) => idOf(assignment.departmentId) === departmentFilter);
        const matchesStatus = statusFilter === 'all' || employee.accountStatus === statusFilter;
        return matchesSearch && matchesDepartment && matchesStatus;
      }),
    [departmentFilter, employees, search, statusFilter],
  );

  const activeCount = employees.filter((employee) => employee.accountStatus === 'active').length;
  const assignmentCount = employees.reduce(
    (total, employee) => total + (employee.accessAssignments?.length || 0),
    0,
  );

  return (
    <div className="mx-auto max-w-[96rem] space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            People & access
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Employees</h1>
          <p className="mt-1 text-sm text-slate-500">
            Employee directory connected to Business Units, Departments, Teams, Roles and Data
            Scope.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <UserPlus size={17} />
          Add Employee
        </button>
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

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total employees
            </span>
            <UsersRound size={17} className="text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{employees.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Active
            </span>
            <BadgeCheck size={17} className="text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Access assignments
            </span>
            <KeyRound size={17} className="text-violet-600" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{assignmentCount}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
          <label className="relative flex-1 lg:max-w-md">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, ID, email or access..."
              className={`${inputClass} py-2 pl-9`}
            />
          </label>
          <select
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
            className={`${inputClass} py-2 lg:w-52`}
          >
            <option value="all">All Departments</option>
            {workspace.departments.map((department) => (
              <option key={department._id} value={department._id}>
                {department.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className={`${inputClass} py-2 lg:w-40`}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="invited">Invited</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
          </select>
          <span className="text-xs font-semibold text-slate-500">{filtered.length} results</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[72rem] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Employee ID</th>
                <th className="px-4 py-3">Access memberships</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joining date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((employee) => (
                <tr key={employee._id} className="align-top hover:bg-blue-50/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                        {initials(employee.name)}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900">{employee.name}</p>
                        <p className="text-xs text-slate-500">{employee.email}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">{employee.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                      {employee.employeeId || 'Legacy record'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-2">
                      {employee.accessAssignments?.map((assignment) => (
                        <div
                          key={assignment._id}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-slate-800">
                              {assignment.departmentId?.name}
                            </span>
                            <span className="text-slate-300">·</span>
                            <span className="text-xs font-semibold text-blue-700">
                              {assignment.roleId?.roleLabel}
                            </span>
                            {assignment.isPrimary && (
                              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                                Primary
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {assignment.businessUnitIds
                              .map((unit) => unit.name.replace('BrainADZ ', ''))
                              .join(', ')}
                            {assignment.teamIds.length
                              ? ` · ${assignment.teamIds.map((team) => team.name).join(', ')}`
                              : ''}{' '}
                            · {assignment.dataScope.replaceAll('_', ' ')}
                          </p>
                        </div>
                      ))}
                      {!employee.accessAssignments?.length && (
                        <span className="text-xs text-amber-600">
                          Legacy access · migrate when editing
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {employee.position || '—'}
                    <span className="mt-1 block text-xs capitalize text-slate-400">
                      {employee.employmentType?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${employee.accountStatus === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {employee.accountStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {employee.joiningDate
                      ? new Date(employee.joiningDate).toLocaleDateString('en-IN')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(employee)}
                        title="Edit employee"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeEmployee(employee)}
                        title="Delete employee"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-500 transition hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !filtered.length && (
                <tr>
                  <td colSpan="7" className="px-4 py-16 text-center">
                    <UsersRound size={28} className="mx-auto text-slate-300" />
                    <p className="mt-3 text-sm font-semibold text-slate-600">No employees found</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Add the first employee or change the filters.
                    </p>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan="7" className="px-4 py-16 text-center text-sm text-slate-500">
                    Loading employee directory...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4">
          <form
            onSubmit={submit}
            className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          >
            <div className="sticky top-0 z-20 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">
                  {editingEmployee ? 'Edit Employee' : 'Add Employee'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {editingEmployee
                    ? 'Update employee details and access assignments.'
                    : 'Employee ID will be generated automatically when saved.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={19} />
              </button>
            </div>
            <div className="space-y-7 p-6">
              <section>
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <UserPlus size={16} />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Employee details</h3>
                    <p className="text-xs text-slate-500">Personal and employment information</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <label>
                    <span className={labelClass}>Full name *</span>
                    <input
                      required
                      value={personal.name}
                      onChange={(event) => updatePersonal('name', event.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label>
                    <span className={labelClass}>Work email *</span>
                    <input
                      required
                      type="email"
                      value={personal.email}
                      onChange={(event) => updatePersonal('email', event.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label>
                    <span className={labelClass}>Phone *</span>
                    <input
                      required
                      value={personal.phone}
                      onChange={(event) => updatePersonal('phone', event.target.value)}
                      placeholder="10-digit mobile"
                      className={inputClass}
                    />
                  </label>
                  <label>
                    <span className={labelClass}>
                      {editingEmployee ? 'New password (optional)' : 'Login password *'}
                    </span>
                    <PasswordInput
                      required={!editingEmployee}
                      value={personal.password}
                      onChange={(event) => updatePersonal('password', event.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label>
                    <span className={labelClass}>Designation / Position *</span>
                    <input
                      required
                      value={personal.position}
                      onChange={(event) => updatePersonal('position', event.target.value)}
                      placeholder="e.g. Senior Designer"
                      className={inputClass}
                    />
                  </label>
                  <label>
                    <span className={labelClass}>Employment type</span>
                    <select
                      value={personal.employmentType}
                      onChange={(event) => updatePersonal('employmentType', event.target.value)}
                      className={inputClass}
                    >
                      <option value="full_time">Full Time</option>
                      <option value="part_time">Part Time</option>
                      <option value="intern">Intern</option>
                      <option value="contract">Contract</option>
                      <option value="consultant">Consultant</option>
                    </select>
                  </label>
                  <label>
                    <span className={labelClass}>Joining date</span>
                    <input
                      type="date"
                      value={personal.joiningDate}
                      onChange={(event) => updatePersonal('joiningDate', event.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label>
                    <span className={labelClass}>Work location</span>
                    <input
                      value={personal.workLocation}
                      onChange={(event) => updatePersonal('workLocation', event.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className={labelClass}>Address</span>
                    <input
                      value={personal.address}
                      onChange={(event) => updatePersonal('address', event.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className={labelClass}>Emergency contact</span>
                    <input
                      value={personal.emergencyContact}
                      onChange={(event) => updatePersonal('emergencyContact', event.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>
              </section>

              <section>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                      <ShieldCheck size={16} />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Access assignments</h3>
                      <p className="text-xs text-slate-500">
                        One employee can work across multiple Business Units, Departments and Teams.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAssignments((current) => [...current, newAssignment(false)])}
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700"
                  >
                    <Plus size={14} />
                    Add Access Row
                  </button>
                </div>
                <div className="space-y-3">
                  {assignments.map((assignment, index) => {
                    const department = workspace.departments.find(
                      (item) => item._id === assignment.departmentId,
                    );
                    const departmentUnitIds = department?.businessUnitIds.map(idOf) || [];
                    const availableTeams = workspace.teams.filter(
                      (team) =>
                        idOf(team.departmentId) === assignment.departmentId &&
                        team.businessUnitIds.some((unitId) =>
                          assignment.businessUnitIds.includes(idOf(unitId)),
                        ),
                    );
                    const availableRoles = workspace.roles.filter((role) =>
                      roleFitsAssignment(role, assignment.departmentId, assignment.businessUnitIds),
                    );
                    const selectedAssignmentRole = workspace.roles.find(
                      (role) => role._id === assignment.roleId,
                    );
                    const availableDataScopes = DATA_SCOPES.filter(
                      (scope) =>
                        DATA_SCOPE_RANK[scope] <=
                        DATA_SCOPE_RANK[
                          selectedAssignmentRole?.defaultDataScope || 'ASSIGNED'
                        ],
                    );
                    return (
                      <div
                        key={index}
                        className={`rounded-xl border p-4 ${assignment.isPrimary ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200'}`}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPrimary(index)}
                              className={`flex h-5 w-5 items-center justify-center rounded-full border ${assignment.isPrimary ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'}`}
                            >
                              {assignment.isPrimary && <Check size={12} />}
                            </button>
                            <span className="text-xs font-semibold text-slate-700">
                              Access {index + 1}
                              {assignment.isPrimary ? ' · Primary' : ''}
                            </span>
                          </div>
                          {assignments.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeAssignment(index)}
                              className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                        <div className="grid gap-3 lg:grid-cols-5">
                          <label>
                            <span className={labelClass}>Department *</span>
                            <select
                              value={assignment.departmentId}
                              onChange={(event) => {
                                const nextDepartment = workspace.departments.find(
                                  (item) => item._id === event.target.value,
                                );
                                const nextBusinessUnitIds =
                                  nextDepartment?.businessUnitIds.slice(0, 1).map(idOf) || [];
                                const nextRoles = workspace.roles.filter((role) =>
                                  roleFitsAssignment(
                                    role,
                                    event.target.value,
                                    nextBusinessUnitIds,
                                  ),
                                );
                                const nextRole =
                                  nextRoles.find((role) => role._id === assignment.roleId) ||
                                  nextRoles.find((role) => role.roleKey === 'employee') ||
                                  nextRoles[0];
                                updateAssignment(index, {
                                  departmentId: event.target.value,
                                  businessUnitIds: nextBusinessUnitIds,
                                  teamIds: [],
                                  roleId: nextRole?._id || '',
                                  dataScope: nextRole?.defaultDataScope || 'ASSIGNED',
                                });
                              }}
                              className={inputClass}
                            >
                              {workspace.departments.map((item) => (
                                <option key={item._id} value={item._id}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <fieldset>
                            <legend className={labelClass}>Business Units *</legend>
                            <div className="relative">
                              <details className="group">
                                <summary
                                  className={`${inputClass} flex cursor-pointer list-none items-center justify-between`}
                                >
                                  <span className="truncate">
                                    {assignment.businessUnitIds.length
                                      ? `${assignment.businessUnitIds.length} selected`
                                      : 'Select'}
                                  </span>
                                  <ChevronDown size={15} />
                                </summary>
                                <div className="absolute z-30 mt-1 w-64 space-y-1 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
                                  {workspace.businessUnits
                                    .filter((unit) => departmentUnitIds.includes(unit._id))
                                    .map((unit) => {
                                      const active = assignment.businessUnitIds.includes(unit._id);
                                      return (
                                        <button
                                          key={unit._id}
                                          type="button"
                                          onClick={() =>
                                            updateAssignment(index, {
                                              businessUnitIds: active
                                                ? assignment.businessUnitIds.filter(
                                                    (id) => id !== unit._id,
                                                  )
                                                : [...assignment.businessUnitIds, unit._id],
                                              teamIds: [],
                                            })
                                          }
                                          className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs font-semibold ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                                        >
                                          <span>{unit.name}</span>
                                          {active && <Check size={13} />}
                                        </button>
                                      );
                                    })}
                                </div>
                              </details>
                            </div>
                          </fieldset>
                          <fieldset>
                            <legend className={labelClass}>Teams</legend>
                            <div className="relative">
                              <details>
                                <summary
                                  className={`${inputClass} flex cursor-pointer list-none items-center justify-between`}
                                >
                                  <span className="truncate">
                                    {assignment.teamIds.length
                                      ? `${assignment.teamIds.length} selected`
                                      : 'Optional'}
                                  </span>
                                  <ChevronDown size={15} />
                                </summary>
                                <div className="absolute z-30 mt-1 w-64 space-y-1 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
                                  {availableTeams.map((team) => {
                                    const active = assignment.teamIds.includes(team._id);
                                    return (
                                      <button
                                        key={team._id}
                                        type="button"
                                        onClick={() =>
                                          updateAssignment(index, {
                                            teamIds: active
                                              ? assignment.teamIds.filter((id) => id !== team._id)
                                              : [...assignment.teamIds, team._id],
                                          })
                                        }
                                        className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs font-semibold ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                                      >
                                        <span>{team.name}</span>
                                        {active && <Check size={13} />}
                                      </button>
                                    );
                                  })}
                                  {!availableTeams.length && (
                                    <p className="px-2 py-3 text-xs text-slate-400">
                                      No teams for this selection
                                    </p>
                                  )}
                                </div>
                              </details>
                            </div>
                          </fieldset>
                          <label>
                            <span className={labelClass}>Role *</span>
                            <select
                              value={assignment.roleId}
                              onChange={(event) => {
                                const role = workspace.roles.find(
                                  (item) => item._id === event.target.value,
                                );
                                const assignableTeamIds = (role?.assignableTeamIds || []).map(idOf);
                                updateAssignment(index, {
                                  roleId: event.target.value,
                                  dataScope: role?.defaultDataScope || assignment.dataScope,
                                  teamIds: assignableTeamIds.length
                                    ? assignment.teamIds.filter((id) =>
                                        assignableTeamIds.includes(id),
                                      )
                                    : assignment.teamIds,
                                });
                              }}
                              className={inputClass}
                            >
                              {availableRoles.map((role) => (
                                  <option key={role._id} value={role._id}>
                                    {role.roleLabel}
                                  </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span className={labelClass}>Data Scope *</span>
                            <select
                              value={assignment.dataScope}
                              onChange={(event) =>
                                updateAssignment(index, { dataScope: event.target.value })
                              }
                              className={inputClass}
                            >
                              {availableDataScopes.map((scope) => (
                                <option key={scope} value={scope}>
                                  {scope.replaceAll('_', ' ')}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </p>
              )}
            </div>
            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {editingEmployee ? <Pencil size={16} /> : <UserPlus size={16} />}
                {saving
                  ? editingEmployee
                    ? 'Updating employee...'
                    : 'Creating employee...'
                  : editingEmployee
                    ? 'Update Employee'
                    : 'Create Employee'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Employees;
