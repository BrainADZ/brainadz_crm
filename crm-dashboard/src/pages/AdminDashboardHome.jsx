import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { CalendarDays, Database, UsersRound } from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import BusinessOverview from './BusinessOverview';

const getAdminHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
});

const formatDateTime = (date, time) => {
  if (!date) return 'No date';
  const value = new Date(`${date}T${time || '00:00'}`);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
};

const formatDate = (value) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
};

const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'AD';

const StatCard = ({ label, value, note, tone, icon, to, action, loading }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-px hover:border-blue-200 hover:shadow-md">
    <div className="flex items-start justify-between gap-4">
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
    </div>
    {loading ? (
      <div className="mt-4 space-y-2" aria-label={`Loading ${label}`}>
        <div className="h-8 w-16 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
      </div>
    ) : (
      <>
        <p className="mt-4 text-[1.75rem] font-semibold leading-none text-slate-950">{value}</p>
        <p className="mt-2 text-sm font-semibold text-slate-700">{label}</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="truncate text-xs text-slate-500">{note}</p>
          <Link to={to} className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-800">
            {action} →
          </Link>
        </div>
      </>
    )}
  </article>
);

const EmptyState = ({ icon: Icon, title, copy, to, action }) => (
  <div className="flex flex-col items-center px-5 py-7 text-center">
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
      <Icon size={19} strokeWidth={1.8} />
    </span>
    <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
    <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">{copy}</p>
    {to && (
      <Link to={to} className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-800">
        {action} →
      </Link>
    )}
  </div>
);

const AdminDashboardHome = () => {
  const [profile, setProfile] = useState(null);
  const [taskSummary, setTaskSummary] = useState({ employees: [], meetings: [], totals: {} });
  const [datasets, setDatasets] = useState([]);
  const [businessRefreshToken, setBusinessRefreshToken] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const headers = getAdminHeaders();
      const [profileResponse, summaryResponse, datasetsResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/profile`, { headers }),
        axios.get(`${API_BASE_URL}/api/tasks/admin-summary`, { headers }),
        axios.get(`${API_BASE_URL}/api/client-datasets`, { headers }),
      ]);

      setProfile(profileResponse.data.user);
      setTaskSummary(summaryResponse.data);
      setDatasets(datasetsResponse.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load dashboard');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const refreshDashboard = () => {
    loadDashboard();
    setBusinessRefreshToken((current) => current + 1);
  };

  const upcomingMeetings = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (taskSummary.meetings || [])
      .filter((meeting) => meeting.meetingDate >= today)
      .slice(0, 3);
  }, [taskSummary.meetings]);

  const busiestEmployees = useMemo(
    () =>
      [...(taskSummary.employees || [])]
        .sort((first, second) => second.assignedCount - first.assignedCount)
        .slice(0, 5),
    [taskSummary.employees],
  );

  const todayLabel = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  const stats = [
    {
      label: 'Uploaded datasets',
      value: datasets.length,
      note: `${datasets.reduce((total, dataset) => total + (dataset.rowCount || 0), 0)} rows`,
      tone: 'bg-blue-50 text-blue-600',
      icon: (
        <>
          <path d="M4 4h16v16H4z" />
          <path d="M4 10h16" />
          <path d="M10 4v16" />
        </>
      ),
      to: '/dashboard/clients',
      action: 'View data',
    },
    {
      label: 'Assigned data',
      value: taskSummary.totals.assignedData || 0,
      note: 'Rows allocated',
      tone: 'bg-emerald-50 text-emerald-600',
      icon: (
        <>
          <path d="M9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </>
      ),
      to: '/dashboard/tasks',
      action: 'View tasks',
    },
    {
      label: 'Follow ups',
      value: taskSummary.totals.followUps || 0,
      note: 'Need action',
      tone: 'bg-violet-50 text-violet-600',
      icon: (
        <>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 3v6h6" />
          <path d="M12 7v5l3 2" />
        </>
      ),
      to: '/dashboard/tasks',
      action: 'Review',
    },
    {
      label: 'Pending calls',
      value: taskSummary.totals.pendingCalls || 0,
      note: `${taskSummary.totals.meetings || 0} meetings`,
      tone: 'bg-amber-50 text-amber-600',
      icon: (
        <>
          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.4 2.1L8 9.7a16 16 0 0 0 6.3 6.3l1.3-1.3a2 2 0 0 1 2.1-.4c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2Z" />
        </>
      ),
      to: '/dashboard/tasks',
      action: 'Review',
    },
  ];

  return (
    <div className="w-full space-y-4">
      <section className="ui-hero relative overflow-hidden rounded-2xl border ui-border p-5 shadow-sm">
        <span className="dashboard-hero-glow absolute -right-16 -top-20 h-56 w-56 rounded-full blur-3xl" />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center">
            <div>
              <p className="text-xs font-semibold text-blue-600">{todayLabel}</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-950">
                Welcome back, {profile?.name || 'Admin'}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Live company overview across sales, finance, projects, uploaded data, tasks, and
                meetings.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={refreshDashboard}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-blue-700"
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
              to="/dashboard/clients"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Upload data
            </Link>
            <Link
              to="/dashboard/tasks"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
            >
              View tasks
            </Link>
          </div>
        </div>
      </section>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} loading={isLoading} />
        ))}
      </section>

      <BusinessOverview embedded refreshToken={businessRefreshToken} />

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">Employee workload</h2>
            <p className="mt-1 text-sm text-slate-500">
              Assigned rows, follow-ups, pending calls, and meetings.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-5 py-3">Employee</th>
                  <th className="whitespace-nowrap px-5 py-3">Assigned</th>
                  <th className="whitespace-nowrap px-5 py-3">Follow up</th>
                  <th className="whitespace-nowrap px-5 py-3">Pending</th>
                  <th className="whitespace-nowrap px-5 py-3">Meetings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {busiestEmployees.map((employee) => (
                  <tr key={employee._id} className="transition hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-xs font-bold text-blue-700">
                          {getInitials(employee.name)}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {employee.name || 'Employee'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {employee.position || employee.email || 'Team member'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-800">
                      {employee.assignedCount}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-violet-700">
                      {employee.followUpCount}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-amber-700">
                      {employee.pendingCallCount}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-emerald-700">
                      {employee.meetingCount}
                    </td>
                  </tr>
                ))}
                {!isLoading && busiestEmployees.length === 0 && (
                  <tr>
                    <td colSpan="5">
                      <EmptyState
                        icon={UsersRound}
                        title="No employee workload yet"
                        copy="Employee assignments and follow-ups will appear here."
                        to="/dashboard/employees"
                        action="View employees"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Upcoming meetings</h2>
              <p className="mt-1 text-sm text-slate-500">Next meetings from employee tasks.</p>
            </div>
            <Link
              to="/dashboard/meetings"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {upcomingMeetings.map((meeting) => (
              <div key={meeting._id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {meeting.clientName || meeting.companyName || 'Client meeting'}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {meeting.employee?.name || 'Employee'} - {meeting.datasetName}
                    </p>
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
            {!isLoading && upcomingMeetings.length === 0 && (
              <EmptyState
                icon={CalendarDays}
                title="No upcoming meetings"
                copy="Scheduled client and team meetings will appear here."
                to="/dashboard/meetings"
                action="View meetings"
              />
            )}
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Recent uploaded data</h2>
            <p className="mt-1 text-sm text-slate-500">Latest Excel datasets available in CRM.</p>
          </div>
          <Link
            to="/dashboard/clients"
            className="w-fit rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Manage data
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-5 py-3">Dataset</th>
                <th className="whitespace-nowrap px-5 py-3">Year</th>
                <th className="whitespace-nowrap px-5 py-3">Rows</th>
                <th className="whitespace-nowrap px-5 py-3">Uploaded</th>
                <th className="px-5 py-3">File</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {datasets.slice(0, 5).map((dataset) => (
                <tr key={dataset._id} className="transition hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <Link
                      to={`/dashboard/clients/${dataset._id}`}
                      className="font-semibold text-blue-600 hover:text-blue-800"
                    >
                      {dataset.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                    {dataset.year || '-'}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-700">{dataset.rowCount}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                    {formatDate(dataset.createdAt)}
                  </td>
                  <td className="px-5 py-4 text-slate-500">{dataset.originalFileName}</td>
                </tr>
              ))}
              {!isLoading && datasets.length === 0 && (
                <tr>
                  <td colSpan="5">
                    <EmptyState
                      icon={Database}
                      title="No uploaded datasets yet"
                      copy="Upload client data to start tracking assignments and activity."
                      to="/dashboard/clients"
                      action="Manage data"
                    />
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

export default AdminDashboardHome;
