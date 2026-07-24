import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL, getAssetUrl } from '../config/api';

const getEmployeeHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('employeeToken')}`,
});

const formatDateTime = (date, time) => {
  if (!date) return '-';
  const value = new Date(`${date}T${time || '00:00'}`);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
};

const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'EM';

const statusClass = (status = '') => {
  const normalized = status.toLowerCase();
  if (normalized === 'follow up') return 'bg-violet-50 text-violet-700';
  if (normalized === 'pending' || !normalized) return 'bg-amber-50 text-amber-700';
  if (normalized.includes('converted') || normalized.includes('interested'))
    return 'bg-emerald-50 text-emerald-700';
  if (normalized.includes('not')) return 'bg-rose-50 text-rose-700';
  return 'bg-blue-50 text-blue-700';
};

const StatCard = ({ label, value, note, tone, icon }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
    <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 fill-none stroke-current"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icon}
      </svg>
    </span>
    <p className="mt-5 text-3xl font-semibold text-slate-950">{value}</p>
    <p className="mt-1 text-sm font-medium text-slate-700">{label}</p>
    <p className="mt-1 text-xs text-slate-500">{note}</p>
  </article>
);

const EmployeeDashboard = () => {
  const [employee, setEmployee] = useState(null);
  const [assignedRows, setAssignedRows] = useState([]);
  const [assignedDatasets, setAssignedDatasets] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const loadDashboard = useCallback(async () => {
    const token = localStorage.getItem('employeeToken');
    if (!token) {
      navigate('/');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const headers = getEmployeeHeaders();
      const [
        employeeResponse,
        rowsResponse,
        datasetsResponse,
        meetingsResponse,
        projectTaskResponse,
      ] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/employees/me`, { headers }),
        axios.get(`${API_BASE_URL}/api/tasks/employee/assigned-rows`, { headers }),
        axios.get(`${API_BASE_URL}/api/client-datasets/assigned/me`, { headers }),
        axios.get(`${API_BASE_URL}/api/tasks/meetings/me`, { headers }),
        axios.get(`${API_BASE_URL}/api/business/project-tasks`, { headers }),
      ]);

      setEmployee(employeeResponse.data);
      setAssignedRows(rowsResponse.data);
      setAssignedDatasets(datasetsResponse.data);
      setMeetings(meetingsResponse.data);
      setProjectTasks(projectTaskResponse.data || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const statusCounts = useMemo(
    () =>
      assignedRows.reduce((counts, row) => {
        const status = row.status || 'Pending';
        return {
          ...counts,
          [status]: (counts[status] || 0) + 1,
        };
      }, {}),
    [assignedRows],
  );

  const upcomingMeetings = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return meetings.filter((meeting) => meeting.meetingDate >= today).slice(0, 5);
  }, [meetings]);

  const followUpCount = statusCounts['Follow Up'] || 0;
  const avatarUrl = getAssetUrl(employee?.imageUrl);

  if (isLoading && !employee) {
    return (
      <div className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white shadow-sm" />
    );
  }

  return (
    <div className="w-full space-y-7">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-xl sm:p-8">
        <span className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-500 text-lg font-bold text-slate-950 ring-4 ring-white/10">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={employee?.name || 'Employee'}
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(employee?.name)
              )}
            </span>
            <div>
              <p className="text-xs font-semibold text-emerald-300">Employee workspace</p>
              <h1 className="mt-1 text-2xl font-semibold">
                Welcome, {employee?.name || 'Employee'}
              </h1>
              <p className="mt-1 max-w-xl text-sm leading-6 text-slate-300">
                Work your assigned data, update outcomes, and keep meetings visible.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadDashboard}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              <svg
                viewBox="0 0 24 24"
                className={`h-4 w-4 fill-none stroke-current ${isLoading ? 'animate-spin' : ''}`}
                strokeWidth="2"
              >
                <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5m-5 4a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" />
              </svg>
              Refresh
            </button>
            <Link
              to="/employee-dashboard/datasets"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              Open data
            </Link>
            <Link
              to="/employee-dashboard/tasks"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              Open tasks
            </Link>
          </div>
        </div>
      </section>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Assigned rows"
          value={assignedRows.length}
          note={`${assignedDatasets.length} datasets`}
          tone="bg-emerald-50 text-emerald-600"
          icon={
            <>
              <path d="M4 4h16v16H4z" />
              <path d="M4 10h16" />
              <path d="M10 4v16" />
            </>
          }
        />
        <StatCard
          label="My open tasks"
          value={projectTasks.filter((task) => task.status !== 'Complete').length}
          note={`${projectTasks.length} total assigned`}
          tone="bg-amber-50 text-amber-600"
          icon={
            <>
              <path d="M9 11 12 14 22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </>
          }
        />
        <StatCard
          label="Follow ups"
          value={followUpCount}
          note="Needs next action"
          tone="bg-violet-50 text-violet-600"
          icon={
            <>
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 3v6h6" />
              <path d="M12 7v5l3 2" />
            </>
          }
        />
        <StatCard
          label="Upcoming meetings"
          value={upcomingMeetings.length}
          note={`${meetings.length} total scheduled`}
          tone="bg-blue-50 text-blue-600"
          icon={
            <>
              <path d="M8 2v4" />
              <path d="M16 2v4" />
              <path d="M3 10h18" />
              <path d="M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z" />
            </>
          }
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 p-5">
            <div>
              <h2 className="text-base font-semibold text-slate-950">My assigned datasets</h2>
              <p className="mt-1 text-sm text-slate-500">
                Open a dataset to work only on your assigned rows.
              </p>
            </div>
            <Link
              to="/employee-dashboard/datasets"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {assignedDatasets.slice(0, 5).map((dataset) => (
              <Link
                key={dataset._id}
                to={`/employee-dashboard/datasets/${dataset._id}`}
                className="flex items-center justify-between gap-4 p-5 transition hover:bg-slate-50"
              >
                <div>
                  <p className="font-semibold text-slate-900">{dataset.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {dataset.year || 'No year'} - {dataset.originalFileName}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  {dataset.rowCount} rows
                </span>
              </Link>
            ))}
            {assignedDatasets.length === 0 && (
              <p className="px-5 py-12 text-center text-sm text-slate-500">
                No assigned datasets yet.
              </p>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-base font-semibold text-slate-950">Upcoming meetings</h2>
            <p className="mt-1 text-sm text-slate-500">Your next scheduled meetings.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {upcomingMeetings.map((meeting) => (
              <div key={meeting._id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {meeting.clientName || meeting.companyName}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{meeting.meetingTitle}</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    {meeting.meetingMode}
                  </span>
                </div>
                <p className="mt-3 text-sm font-medium text-slate-700">
                  {formatDateTime(meeting.meetingDate, meeting.meetingTime)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {meeting.platformOrLocation || 'No platform/location'}
                </p>
              </div>
            ))}
            {upcomingMeetings.length === 0 && (
              <p className="px-5 py-12 text-center text-sm text-slate-500">No upcoming meetings.</p>
            )}
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-base font-semibold text-slate-950">Recent assigned rows</h2>
          <p className="mt-1 text-sm text-slate-500">
            A quick look at the data you need to work on.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Dataset</th>
                <th className="whitespace-nowrap px-5 py-3">Status</th>
                <th className="px-5 py-3">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assignedRows.slice(0, 8).map((row) => (
                <tr
                  key={`${row.datasetId}-${row.rowIndex}`}
                  className="transition hover:bg-slate-50"
                >
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900">{row.clientName}</p>
                    <p className="text-xs text-slate-500">
                      {row.companyName || row.city || `Row ${row.serialNumber}`}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{row.datasetName}</td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(row.status || 'Pending')}`}
                    >
                      {row.status || 'Pending'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    <p>{row.phone || '-'}</p>
                    <p className="text-xs">{row.email || ''}</p>
                  </td>
                </tr>
              ))}
              {assignedRows.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-5 py-12 text-center text-sm text-slate-500">
                    No assigned rows yet.
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

export default EmployeeDashboard;
