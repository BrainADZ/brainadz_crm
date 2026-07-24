import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  GripVertical,
  ListTodo,
  RefreshCw,
  Search,
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';

const taskStatuses = ['Backlog', 'To Do', 'In Progress', 'Review', 'Complete'];
const todayKey = new Date().toISOString().slice(0, 10);

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

const getEmployeeHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('employeeToken')}`,
});

const clampProgress = (value) => Math.max(0, Math.min(100, Number(value) || 0));

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const EmployeeTasks = () => {
  const [employee, setEmployee] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState('');
  const [activeDropStatus, setActiveDropStatus] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchTaskData = useCallback(async ({ silent = false } = {}) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    setError('');

    try {
      const headers = getEmployeeHeaders();
      const [employeeResponse, taskResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/employees/me`, { headers }),
        axios.get(`${API_BASE_URL}/api/business/project-tasks`, { headers }),
      ]);
      setEmployee(employeeResponse.data);
      setTasks(taskResponse.data || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load tasks');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTaskData();
  }, [fetchTaskData]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (!normalizedSearch) return true;
        return [
          task.name,
          task.projectName,
          task.team,
          task.status,
          task.priority,
          task.dependency,
        ].some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(normalizedSearch),
        );
      }),
    [normalizedSearch, tasks],
  );

  const openTasks = useMemo(() => tasks.filter((task) => task.status !== 'Complete'), [tasks]);
  const stats = useMemo(
    () => ({
      total: tasks.length,
      open: openTasks.length,
      today: openTasks.filter((task) => task.due === todayKey).length,
      overdue: openTasks.filter((task) => task.due && task.due < todayKey).length,
      complete: tasks.filter((task) => task.status === 'Complete').length,
    }),
    [openTasks, tasks],
  );

  const groupedTasks = useMemo(
    () =>
      taskStatuses.map((status) => ({
        status,
        tasks: filteredTasks.filter((task) => task.status === status),
      })),
    [filteredTasks],
  );

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
      const response = await axios.patch(
        `${API_BASE_URL}/api/business/project-tasks/${task._id}`,
        nextPatch,
        {
          headers: getEmployeeHeaders(),
        },
      );
      const updatedTask = response.data.item || response.data;
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white shadow-sm" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white shadow-sm"
            />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white shadow-sm" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">
            My assigned work
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Tasks</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">
            Showing only tasks assigned to {employee?.name || 'you'}.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative block w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search my tasks..."
              className="h-10 w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <button
            type="button"
            onClick={() => fetchTaskData({ silent: true })}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </section>

      {(message || error) && (
        <p
          className={`rounded-lg border px-4 py-3 text-sm font-bold ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
        >
          {error || message}
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Total Tasks', stats.total, ListTodo, 'bg-emerald-50 text-emerald-700'],
          ['Open Tasks', stats.open, CalendarClock, 'bg-blue-50 text-blue-700'],
          ['Due Today', stats.today, AlertTriangle, 'bg-amber-50 text-amber-700'],
          ['Complete', stats.complete, CheckCircle2, 'bg-slate-100 text-slate-700'],
        ].map(([label, value, Icon, tone]) => (
          <article
            key={label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
              <Icon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
          </article>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-bold text-slate-950">Workflow Board</h2>
          <p className="mt-1 text-sm text-slate-500">
            Drag a task into another column to update its status.
          </p>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-5">
          {groupedTasks.map((column) => (
            <div
              key={column.status}
              onDragEnter={(event) => handleStatusDragOver(event, column.status)}
              onDragOver={(event) => handleStatusDragOver(event, column.status)}
              onDrop={(event) => dropTaskOnStatus(event, column.status)}
              className={`min-h-72 rounded-lg border bg-slate-50 transition ${
                draggedTaskId && activeDropStatus === column.status
                  ? 'border-emerald-400 bg-emerald-50/70 ring-2 ring-emerald-100'
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
                    className={`cursor-grab select-none rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition active:cursor-grabbing ${
                      draggedTaskId === task._id
                        ? 'opacity-50 ring-2 ring-emerald-200'
                        : 'hover:border-emerald-200 hover:shadow-md'
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
                    <p className="mt-1 truncate text-xs font-semibold text-emerald-700">
                      {task.projectName || 'General Task'}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2 text-xs font-semibold text-slate-500">
                      <span>{task.team || 'Team'}</span>
                      <span>{formatDate(task.due)}</span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-emerald-600"
                        style={{ width: `${clampProgress(task.progress)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {column.tasks.length === 0 && (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-6 text-center text-xs font-semibold text-slate-500">
                    No tasks
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-bold text-slate-950">Task List</h2>
          <p className="mt-1 text-sm text-slate-500">
            You can also update status and progress inline.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[64rem] w-full table-fixed border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="w-72 border-b border-r border-slate-200 px-4 py-2 font-bold">
                  Task
                </th>
                <th className="w-44 border-b border-r border-slate-200 px-4 py-2 font-bold">Due</th>
                <th className="w-44 border-b border-r border-slate-200 px-4 py-2 font-bold">
                  Status
                </th>
                <th className="w-44 border-b border-r border-slate-200 px-4 py-2 font-bold">
                  Progress
                </th>
                <th className="w-36 border-b border-r border-slate-200 px-4 py-2 font-bold">
                  Priority
                </th>
                <th className="w-52 border-b border-slate-200 px-4 py-2 font-bold">Dependency</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => (
                <tr key={task._id} className="bg-white transition hover:bg-emerald-50/40">
                  <td className="border-b border-r border-slate-100 px-4 py-3">
                    <p className="truncate font-bold text-slate-950">{task.name}</p>
                    <p className="mt-0.5 truncate text-xs font-semibold text-emerald-700">
                      {task.projectName || 'General Task'}
                    </p>
                  </td>
                  <td className="border-b border-r border-slate-100 px-4 py-3">
                    <span
                      className={`font-bold ${task.status !== 'Complete' && task.due && task.due < todayKey ? 'text-red-700' : 'text-slate-700'}`}
                    >
                      {formatDate(task.due)}
                    </span>
                  </td>
                  <td className="border-b border-r border-slate-100 px-4 py-3">
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
                  <td className="border-b border-r border-slate-100 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={task.progress || 0}
                        onChange={(event) => updateTask(task, { progress: event.target.value })}
                        className="h-9 w-20 rounded-lg border border-slate-300 px-2 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                      <div className="h-2 flex-1 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-emerald-600"
                          style={{ width: `${clampProgress(task.progress)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="border-b border-r border-slate-100 px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${priorityTone[task.priority] || priorityTone.Medium}`}
                    >
                      {task.priority || 'Medium'}
                    </span>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-slate-600">
                    <span className="block truncate">{task.dependency || '-'}</span>
                  </td>
                </tr>
              ))}
              {filteredTasks.length === 0 && (
                <tr>
                  <td
                    colSpan="6"
                    className="px-5 py-16 text-center text-sm font-semibold text-slate-500"
                  >
                    No assigned tasks found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default EmployeeTasks;
