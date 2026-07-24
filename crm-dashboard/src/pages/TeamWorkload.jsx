import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Building2, Gauge, RefreshCw, Search, UsersRound } from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { getAdminHeaders, getWorkStructure, listBusinessResource } from '../services/businessApi';

const todayKey = new Date().toISOString().slice(0, 10);
const capacityPerEmployee = 5;

const inputClass =
  'h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'TM';

const TeamWorkload = () => {
  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [structure, setStructure] = useState({ modules: [], teams: [] });
  const [moduleFilter, setModuleFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    setError('');

    try {
      const [employeeResponse, taskRows, structureResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/employees`, { headers: getAdminHeaders() }),
        listBusinessResource('project-tasks'),
        getWorkStructure(),
      ]);

      setEmployees(Array.isArray(employeeResponse.data) ? employeeResponse.data : []);
      setTasks(taskRows || []);
      setStructure({
        modules: structureResponse.modules || [],
        teams: structureResponse.teams || [],
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load team workload');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const moduleOptions = useMemo(
    () => structure.modules.map((moduleItem) => moduleItem.name),
    [structure.modules],
  );

  const teamOptions = useMemo(() => {
    const rows =
      moduleFilter === 'all'
        ? structure.teams
        : structure.teams.filter((team) => team.moduleName === moduleFilter);
    return rows.map((team) => team.name);
  }, [moduleFilter, structure.teams]);

  const employeeRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return employees
      .map((employee) => {
        const officeModule = employee.officeModule || employee.department || 'Unassigned Module';
        const team = employee.team || 'Unassigned Team';
        const openTasks = tasks.filter(
          (task) =>
            task.status !== 'Complete' &&
            (task.assigneeEmail === employee.email || task.assignee === employee.name),
        );
        const allTasks = tasks.filter(
          (task) => task.assigneeEmail === employee.email || task.assignee === employee.name,
        );
        const utilization = Math.min(
          100,
          Math.round((openTasks.length / capacityPerEmployee) * 100),
        );

        return {
          id: employee._id,
          name: employee.name || employee.email || 'Employee',
          email: employee.email || '',
          designation: employee.position || 'Team member',
          officeModule,
          team,
          open: openTasks.length,
          total: allTasks.length,
          today: openTasks.filter((task) => task.due === todayKey).length,
          overdue: openTasks.filter((task) => task.due && task.due < todayKey).length,
          high: openTasks.filter((task) => task.priority === 'High').length,
          utilization,
        };
      })
      .filter((employee) => {
        const matchesModule = moduleFilter === 'all' || employee.officeModule === moduleFilter;
        const matchesTeam = teamFilter === 'all' || employee.team === teamFilter;
        const matchesSearch =
          !normalizedSearch ||
          [
            employee.name,
            employee.email,
            employee.designation,
            employee.officeModule,
            employee.team,
          ].some((value) =>
            String(value || '')
              .toLowerCase()
              .includes(normalizedSearch),
          );

        return matchesModule && matchesTeam && matchesSearch;
      })
      .sort((first, second) => second.open - first.open);
  }, [employees, moduleFilter, searchTerm, tasks, teamFilter]);

  const groupedWorkload = useMemo(() => {
    const groups = new Map();
    employeeRows.forEach((employee) => {
      const key = `${employee.officeModule}::${employee.team}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          moduleName: employee.officeModule,
          teamName: employee.team,
          employees: [],
          open: 0,
          overdue: 0,
        });
      }
      const group = groups.get(key);
      group.employees.push(employee);
      group.open += employee.open;
      group.overdue += employee.overdue;
    });
    return Array.from(groups.values()).sort((first, second) => second.open - first.open);
  }, [employeeRows]);

  const stats = useMemo(
    () => ({
      modules: new Set(employeeRows.map((employee) => employee.officeModule)).size,
      teams: groupedWorkload.length,
      employees: employeeRows.length,
      openTasks: employeeRows.reduce((total, employee) => total + employee.open, 0),
    }),
    [employeeRows, groupedWorkload.length],
  );

  const teamDirectory = useMemo(
    () =>
      moduleOptions.map((moduleName) => ({
        moduleName,
        teams: structure.teams.filter((team) => team.moduleName === moduleName),
      })),
    [moduleOptions, structure.teams],
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-md border border-slate-200 bg-white shadow-sm" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-md border border-slate-200 bg-white shadow-sm"
            />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-md border border-slate-200 bg-white shadow-sm" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <Gauge className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Team capacity
            </p>
            <h1 className="text-2xl font-bold text-slate-950">Team Workload</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">
              Module, team and employee wise open task load.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => loadData({ silent: true })}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </section>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Modules', stats.modules, Building2],
          ['Teams', stats.teams, UsersRound],
          ['Employees', stats.employees, UsersRound],
          ['Open Tasks', stats.openTasks, Gauge],
        ].map(([label, value, Icon]) => (
          <article
            key={label}
            className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Icon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
          </article>
        ))}
      </section>

      <section className="rounded-md border border-slate-300 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search employee, team, module..."
              className="h-10 w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <select
            value={moduleFilter}
            onChange={(event) => {
              setModuleFilter(event.target.value);
              setTeamFilter('all');
            }}
            className={inputClass}
          >
            <option value="all">All modules</option>
            {moduleOptions.map((moduleName) => (
              <option key={moduleName} value={moduleName}>
                {moduleName}
              </option>
            ))}
          </select>
          <select
            value={teamFilter}
            onChange={(event) => setTeamFilter(event.target.value)}
            className={inputClass}
          >
            <option value="all">All teams</option>
            {teamOptions.map((teamName) => (
              <option key={teamName} value={teamName}>
                {teamName}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-md border border-slate-300 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-300 px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-slate-950">Team Directory</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Office module ke under available teams.
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            {structure.teams.length} teams
          </span>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {teamDirectory.map((group) => (
            <article
              key={group.moduleName}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-900">{group.moduleName}</h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500">
                  {group.teams.length}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {group.teams.map((team) => (
                  <span
                    key={team._id}
                    className="rounded-full border border-blue-100 bg-white px-2.5 py-1 text-xs font-bold text-blue-700"
                  >
                    {team.name}
                  </span>
                ))}
                {group.teams.length === 0 && (
                  <span className="text-xs font-semibold text-slate-500">No teams</span>
                )}
              </div>
            </article>
          ))}
          {teamDirectory.length === 0 && (
            <p className="col-span-full px-4 py-8 text-center text-sm font-semibold text-slate-500">
              No team directory found.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {groupedWorkload.map((group) => (
          <article
            key={group.key}
            className="overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-300 px-4 py-3">
              <div>
                <h2 className="text-base font-bold text-slate-950">{group.teamName}</h2>
                <p className="mt-1 text-xs font-semibold text-blue-700">{group.moduleName}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-slate-950">{group.open}</p>
                <p className="text-xs font-semibold text-slate-500">{group.overdue} overdue</p>
              </div>
            </div>
            <div className="divide-y divide-slate-200">
              {group.employees.map((employee) => (
                <div key={employee.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                        {getInitials(employee.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-slate-900">
                          {employee.name}
                        </span>
                        <span className="block truncate text-xs font-medium text-slate-500">
                          {employee.designation}
                        </span>
                      </span>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                      {employee.open} open
                    </span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full ${employee.utilization > 80 ? 'bg-red-500' : employee.utilization > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${employee.utilization}%` }}
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-2 text-xs font-semibold text-slate-500">
                    <span>{employee.utilization}% load</span>
                    <span>{employee.today} today</span>
                    <span>{employee.overdue} overdue</span>
                    <span>{employee.high} high</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
        {groupedWorkload.length === 0 && (
          <p className="rounded-md border border-slate-300 bg-white px-4 py-16 text-center text-sm font-semibold text-slate-500 shadow-sm xl:col-span-2">
            No workload found for this filter.
          </p>
        )}
      </section>
    </div>
  );
};

export default TeamWorkload;
