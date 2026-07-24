import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Download,
  FolderKanban,
  GripVertical,
  ListTodo,
  Plus,
  RefreshCw,
  Search,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import {
  createBusinessResource,
  deleteBusinessResource,
  getAdminHeaders,
  listBusinessResource,
  updateBusinessResource,
} from '../services/businessApi';

const taskStatuses = ['Backlog', 'To Do', 'In Progress', 'Review', 'Complete'];
const priorityOptions = ['High', 'Medium', 'Low'];
const teamOptions = ['Delivery', 'Sales', 'Marketing', 'Accounts', 'Operations', 'Support'];

const todayKey = new Date().toISOString().slice(0, 10);

const emptyTask = {
  name: '',
  project: '',
  assignee: '',
  assigneeEmail: '',
  team: 'Delivery',
  due: todayKey,
  status: 'To Do',
  progress: 0,
  dependency: '',
  priority: 'Medium',
  milestone: false,
};

const statusTone = {
  Backlog: 'border-slate-200 bg-slate-50 text-slate-700',
  'To Do': 'border-blue-200 bg-blue-50 text-blue-700',
  'In Progress': 'border-amber-200 bg-amber-50 text-amber-700',
  Review: 'border-violet-200 bg-violet-50 text-violet-700',
  Complete: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const priorityTone = {
  High: 'border-red-200 bg-red-50 text-red-700',
  Medium: 'border-amber-200 bg-amber-50 text-amber-700',
  Low: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const iconButtonClass =
  'inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700';
const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const labelClass = 'text-xs font-bold uppercase tracking-wide text-slate-500';

const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'TM';

const clampProgress = (value) => Math.max(0, Math.min(100, Number(value) || 0));

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const Modal = ({ title, children, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
    <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Task control</p>
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        </div>
        <button type="button" onClick={onClose} className={iconButtonClass} title="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-[calc(90vh-5rem)] overflow-y-auto p-5">{children}</div>
    </div>
  </div>
);

const AdminTasks = () => {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [taskForm, setTaskForm] = useState(emptyTask);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState('');
  const [activeDropStatus, setActiveDropStatus] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchWorkspace = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError('');

    try {
      const [projectRows, taskRows, employeeResponse] = await Promise.all([
        listBusinessResource('projects'),
        listBusinessResource('project-tasks'),
        axios.get(`${API_BASE_URL}/api/employees`, { headers: getAdminHeaders() }),
      ]);

      setProjects(projectRows || []);
      setTasks(taskRows || []);
      setEmployees(
        Array.isArray(employeeResponse.data)
          ? employeeResponse.data
          : employeeResponse.data?.employees || [],
      );
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load employee tasks');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  const projectById = useMemo(
    () =>
      projects.reduce((map, project) => {
        map[String(project._id)] = project;
        return map;
      }, {}),
    [projects],
  );

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const matchesSearch =
          !normalizedSearch ||
          [
            task.name,
            task.projectName,
            projectById[String(task.project)]?.name,
            task.assignee,
            task.assigneeEmail,
            task.team,
            task.status,
            task.priority,
            task.dependency,
          ].some((value) =>
            String(value || '')
              .toLowerCase()
              .includes(normalizedSearch),
          );

        const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
        const matchesOwner =
          ownerFilter === 'all' ||
          task.assigneeEmail === ownerFilter ||
          task.assignee === ownerFilter;

        return matchesSearch && matchesStatus && matchesOwner;
      }),
    [normalizedSearch, ownerFilter, projectById, statusFilter, tasks],
  );

  const openTasks = useMemo(() => tasks.filter((task) => task.status !== 'Complete'), [tasks]);
  const dueToday = useMemo(
    () => openTasks.filter((task) => task.due === todayKey).length,
    [openTasks],
  );
  const overdue = useMemo(
    () => openTasks.filter((task) => task.due && task.due < todayKey).length,
    [openTasks],
  );
  const milestoneCount = useMemo(() => tasks.filter((task) => task.milestone).length, [tasks]);
  const completionRate = tasks.length
    ? Math.round((tasks.filter((task) => task.status === 'Complete').length / tasks.length) * 100)
    : 0;

  const metricCards = [
    {
      label: 'Active Projects',
      value: projects.filter((project) => project.health !== 'Closed').length,
      copy: `${projects.length} total projects`,
      icon: FolderKanban,
      tone: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Tasks Due Today',
      value: dueToday,
      copy: 'Need same-day action',
      icon: CalendarClock,
      tone: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Overdue Tasks',
      value: overdue,
      copy: 'Needs manager attention',
      icon: AlertTriangle,
      tone: 'bg-red-50 text-red-700',
    },
    {
      label: 'Open Tasks',
      value: openTasks.length,
      copy: 'Not completed yet',
      icon: ListTodo,
      tone: 'bg-violet-50 text-violet-700',
    },
    {
      label: 'Milestones',
      value: milestoneCount,
      copy: 'Marked as key deliverables',
      icon: Target,
      tone: 'bg-indigo-50 text-indigo-700',
    },
    {
      label: 'Completion Rate',
      value: `${completionRate}%`,
      copy: `${tasks.filter((task) => task.status === 'Complete').length} completed tasks`,
      icon: CheckCircle2,
      tone: 'bg-emerald-50 text-emerald-700',
    },
  ];

  const groupedTasks = useMemo(
    () =>
      taskStatuses.map((status) => ({
        status,
        tasks: filteredTasks.filter((task) => task.status === status),
      })),
    [filteredTasks],
  );

  const updateForm = (field, value) => {
    setTaskForm((current) => ({ ...current, [field]: value }));
  };

  const openTaskModal = () => {
    setTaskForm(emptyTask);
    setMessage('');
    setError('');
    setIsModalOpen(true);
  };

  const submitTask = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    setMessage('');

    try {
      const selectedEmployee = employees.find(
        (employee) =>
          String(employee._id) === String(taskForm.assignee) ||
          employee.email === taskForm.assignee ||
          employee.name === taskForm.assignee,
      );
      const selectedProject = projects.find(
        (project) => String(project._id) === String(taskForm.project),
      );
      const progress = taskForm.status === 'Complete' ? 100 : clampProgress(taskForm.progress);

      await createBusinessResource('project-tasks', {
        ...taskForm,
        project: selectedProject?._id || undefined,
        projectName: selectedProject?.name || 'General Task',
        assignee: selectedEmployee?.name || taskForm.assignee,
        assigneeEmail: selectedEmployee?.email || taskForm.assigneeEmail,
        team: selectedEmployee?.team || taskForm.team,
        progress,
      });

      setTaskForm(emptyTask);
      setIsModalOpen(false);
      setMessage('Task assigned successfully.');
      await fetchWorkspace({ silent: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save this task');
    } finally {
      setIsSaving(false);
    }
  };

  const updateTask = async (task, patch) => {
    const nextPatch = { ...patch };
    if (nextPatch.progress !== undefined) nextPatch.progress = clampProgress(nextPatch.progress);
    if (nextPatch.status === 'Complete' && nextPatch.progress === undefined)
      nextPatch.progress = 100;
    if (
      nextPatch.status &&
      nextPatch.status !== 'Complete' &&
      task.progress === 100 &&
      nextPatch.progress === undefined
    ) {
      nextPatch.progress = 80;
    }

    try {
      const response = await updateBusinessResource('project-tasks', task._id, nextPatch);
      const updatedTask = response.item || response;
      setTasks((current) => current.map((item) => (item._id === task._id ? updatedTask : item)));
      setMessage('Task updated.');
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update task');
    }
  };

  const startTaskDrag = (event, task) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', task._id);
    setDraggedTaskId(task._id);
    setActiveDropStatus(task.status);
  };

  const finishTaskDrag = () => {
    setDraggedTaskId('');
    setActiveDropStatus('');
  };

  const handleStatusDragOver = (event, status) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setActiveDropStatus(status);
  };

  const dropTaskOnStatus = async (event, status) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData('text/plain') || draggedTaskId;
    const task = tasks.find((item) => item._id === taskId);
    finishTaskDrag();
    if (!task || task.status === status) return;
    await updateTask(task, { status });
  };

  const removeTask = async (task) => {
    try {
      await deleteBusinessResource('project-tasks', task._id);
      setTasks((current) => current.filter((item) => item._id !== task._id));
      setMessage('Task removed.');
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to remove task');
    }
  };

  const downloadTaskCsv = () => {
    const headings = [
      'Task',
      'Project',
      'Assignee',
      'Email',
      'Team',
      'Due',
      'Status',
      'Priority',
      'Progress',
      'Dependency',
      'Milestone',
    ];
    const rows = filteredTasks.map((task) => [
      task.name,
      task.projectName || projectById[String(task.project)]?.name || 'General Task',
      task.assignee,
      task.assigneeEmail,
      task.team,
      task.due,
      task.status,
      task.priority,
      `${task.progress || 0}%`,
      task.dependency,
      task.milestone ? 'Yes' : 'No',
    ]);
    const csv = [headings, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'employee-tasks.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-md border border-slate-200 bg-white shadow-sm" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
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
            <ListTodo className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Employee task control
            </p>
            <h1 className="text-2xl font-bold text-slate-950">Tasks</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">
              Project and team tasks for employees. Sales import data remains in Clients/Sales; this
              section is for internal execution.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative block w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search tasks, projects, owners..."
              className="h-10 w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <button
            type="button"
            onClick={openTaskModal}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Assign Task
          </button>
          <button
            type="button"
            title="Refresh"
            onClick={() => fetchWorkspace({ silent: true })}
            className={iconButtonClass}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            title="Export tasks"
            onClick={downloadTaskCsv}
            className={iconButtonClass}
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </section>

      {(message || error) && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm font-bold ${
            error
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {error || message}
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.label}
              className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.tone}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Live
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-950">{card.value}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                {card.label}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">{card.copy}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-md border border-slate-300 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-300 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-950">Task Register</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Assign employee work, update progress, and track dependencies.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={ownerFilter}
              onChange={(event) => setOwnerFilter(event.target.value)}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 pr-8 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All assignees</option>
              {employees.map((employee) => (
                <option
                  key={employee._id || employee.email}
                  value={employee.email || employee.name}
                >
                  {employee.name || employee.email}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 pr-8 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All statuses</option>
              {taskStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[78rem] w-full table-fixed border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="w-72 border-b border-r border-slate-300 px-4 py-2 font-bold">
                  Task
                </th>
                <th className="w-52 border-b border-r border-slate-300 px-4 py-2 font-bold">
                  Assigned
                </th>
                <th className="w-36 border-b border-r border-slate-300 px-4 py-2 font-bold">Due</th>
                <th className="w-44 border-b border-r border-slate-300 px-4 py-2 font-bold">
                  Status
                </th>
                <th className="w-44 border-b border-r border-slate-300 px-4 py-2 font-bold">
                  Progress
                </th>
                <th className="w-36 border-b border-r border-slate-300 px-4 py-2 font-bold">
                  Priority
                </th>
                <th className="w-52 border-b border-r border-slate-300 px-4 py-2 font-bold">
                  Dependency
                </th>
                <th className="w-20 border-b border-slate-300 px-4 py-2 text-right font-bold">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => {
                const projectName =
                  task.projectName || projectById[String(task.project)]?.name || 'General Task';
                return (
                  <tr key={task._id} className="bg-white transition hover:bg-blue-50/40">
                    <td className="border-b border-r border-slate-200 px-4 py-3">
                      <p className="truncate font-bold text-slate-950">{task.name}</p>
                      <p className="mt-0.5 truncate text-xs font-semibold text-blue-700">
                        {projectName}
                      </p>
                      {task.milestone && (
                        <span className="mt-2 inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                          Milestone
                        </span>
                      )}
                    </td>
                    <td className="border-b border-r border-slate-200 px-4 py-3">
                      <div className="flex max-w-full items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
                          {getInitials(task.assignee)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-slate-800">
                            {task.assignee || 'Unassigned'}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {task.team || task.assigneeEmail || 'Team'}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="border-b border-r border-slate-200 px-4 py-3">
                      <span
                        className={`font-bold ${task.status !== 'Complete' && task.due && task.due < todayKey ? 'text-red-700' : 'text-slate-700'}`}
                      >
                        {formatDate(task.due)}
                      </span>
                    </td>
                    <td className="border-b border-r border-slate-200 px-4 py-3">
                      <select
                        value={task.status}
                        onChange={(event) => updateTask(task, { status: event.target.value })}
                        className={`w-full rounded-lg border px-2 py-1.5 text-xs font-bold outline-none ${statusTone[task.status] || statusTone.Backlog}`}
                      >
                        {taskStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-b border-r border-slate-200 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={task.progress || 0}
                          onChange={(event) => updateTask(task, { progress: event.target.value })}
                          className="h-9 w-20 rounded-lg border border-slate-300 px-2 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                        <div className="h-2 flex-1 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-blue-600"
                            style={{ width: `${clampProgress(task.progress)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-r border-slate-200 px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${priorityTone[task.priority] || priorityTone.Medium}`}
                      >
                        {task.priority || 'Medium'}
                      </span>
                    </td>
                    <td className="border-b border-r border-slate-200 px-4 py-3 text-slate-600">
                      <span className="block truncate">{task.dependency || '-'}</span>
                    </td>
                    <td className="border-b border-slate-200 px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeTask(task)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100"
                        title="Delete task"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan="8" className="h-64 px-4 py-16 text-center">
                    <p className="text-base font-bold text-slate-700">No employee tasks found</p>
                    <p className="mt-2 text-sm text-slate-500">
                      Use Assign Task to create project or general work for the team.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <article className="rounded-md border border-slate-300 bg-white shadow-sm">
          <div className="border-b border-slate-300 px-4 py-3">
            <h2 className="text-base font-bold text-slate-950">Workflow Board</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Same flow as the business OS task board, backed by the CRM database.
            </p>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-5">
            {groupedTasks.map((column) => (
              <div
                key={column.status}
                onDragEnter={(event) => handleStatusDragOver(event, column.status)}
                onDragOver={(event) => handleStatusDragOver(event, column.status)}
                onDrop={(event) => dropTaskOnStatus(event, column.status)}
                className={`min-h-72 rounded-md border bg-slate-50 transition ${
                  draggedTaskId && activeDropStatus === column.status
                    ? 'border-blue-400 bg-blue-50/70 ring-2 ring-blue-100'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                  <span className="text-sm font-bold text-slate-800">{column.status}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500">
                    {column.tasks.length}
                  </span>
                </div>
                <div className="space-y-2 p-3">
                  {column.tasks.map((task) => (
                    <div
                      key={task._id}
                      draggable
                      onDragStart={(event) => startTaskDrag(event, task)}
                      onDragEnd={finishTaskDrag}
                      title="Move task"
                      className={`cursor-grab select-none rounded-md border border-slate-200 bg-white p-3 shadow-sm transition active:cursor-grabbing ${
                        draggedTaskId === task._id
                          ? 'opacity-50 ring-2 ring-blue-200'
                          : 'hover:border-blue-200 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2">
                          <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                          <p className="min-w-0 text-sm font-bold text-slate-950">{task.name}</p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${priorityTone[task.priority] || priorityTone.Medium}`}
                        >
                          {task.priority || 'Medium'}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs font-semibold text-blue-700">
                        {task.projectName ||
                          projectById[String(task.project)]?.name ||
                          'General Task'}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-2 text-xs font-semibold text-slate-500">
                        <span>{task.assignee || 'Unassigned'}</span>
                        <span>{formatDate(task.due)}</span>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-blue-600"
                          style={{ width: `${clampProgress(task.progress)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {column.tasks.length === 0 && (
                    <p className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-6 text-center text-xs font-semibold text-slate-500">
                      No tasks
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      {isModalOpen && (
        <Modal title="Assign Employee Task" onClose={() => setIsModalOpen(false)}>
          <form onSubmit={submitTask} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 md:col-span-2">
                <span className={labelClass}>Task name</span>
                <input
                  required
                  value={taskForm.name}
                  onChange={(event) => updateForm('name', event.target.value)}
                  className={inputClass}
                  placeholder="Prepare client onboarding checklist"
                />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Project</span>
                <select
                  value={taskForm.project}
                  onChange={(event) => updateForm('project', event.target.value)}
                  className={inputClass}
                >
                  <option value="">General Task</option>
                  {projects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Assignee</span>
                <select
                  value={taskForm.assignee}
                  onChange={(event) => updateForm('assignee', event.target.value)}
                  className={inputClass}
                >
                  <option value="">Unassigned</option>
                  {employees.map((employee) => (
                    <option
                      key={employee._id || employee.email}
                      value={employee._id || employee.email}
                    >
                      {employee.name || employee.email}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Team</span>
                <select
                  value={taskForm.team}
                  onChange={(event) => updateForm('team', event.target.value)}
                  className={inputClass}
                >
                  {teamOptions.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Due date</span>
                <input
                  type="date"
                  value={taskForm.due}
                  onChange={(event) => updateForm('due', event.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Status</span>
                <select
                  value={taskForm.status}
                  onChange={(event) => updateForm('status', event.target.value)}
                  className={inputClass}
                >
                  {taskStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Priority</span>
                <select
                  value={taskForm.priority}
                  onChange={(event) => updateForm('priority', event.target.value)}
                  className={inputClass}
                >
                  {priorityOptions.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Progress</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={taskForm.progress}
                  onChange={(event) => updateForm('progress', event.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Dependency</span>
                <input
                  value={taskForm.dependency}
                  onChange={(event) => updateForm('dependency', event.target.value)}
                  className={inputClass}
                  placeholder="Design approval, content, payment..."
                />
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <input
                  type="checkbox"
                  checked={taskForm.milestone}
                  onChange={(event) => updateForm('milestone', event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-bold text-slate-700">Mark as milestone</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? 'Saving...' : 'Assign Task'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default AdminTasks;
