import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flame,
  RefreshCw,
  Target,
  UsersRound,
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { getAdminHeaders } from '../services/businessApi';
import { getAuthenticatedUser } from '../utils/auth';

const formatRole = (value = '') =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatMeeting = (meeting) => {
  const value = new Date(`${meeting.meetingDate}T${meeting.meetingTime || '00:00'}`);
  if (Number.isNaN(value.getTime())) return 'Date not available';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
};

const emptySummary = {
  totalRows: 0,
  assignedRows: 0,
  followUpRows: 0,
  interestedRows: 0,
  convertedRows: 0,
};
const summaryFor = (dataset) => {
  if (dataset.summary) return { ...emptySummary, ...dataset.summary };
  const columns = dataset.columns || [];
  const statusIndex = columns.findIndex(
    (column) => String(column?.key || column?.label || column).trim().toLowerCase() === 'status',
  );
  const statuses = (dataset.rows || []).map((row) =>
    String(Array.isArray(row) ? row[statusIndex] : row?.status || '')
      .trim()
      .toLowerCase(),
  );
  return {
    ...emptySummary,
    totalRows: Number(dataset.rowCount || statuses.length),
    assignedRows: Number(dataset.rowCount || statuses.length),
    followUpRows: statuses.filter((status) => status === 'follow up').length,
    interestedRows: statuses.filter((status) => status === 'interested').length,
    convertedRows: statuses.filter((status) => status === 'converted').length,
  };
};

const SalesDashboard = () => {
  const user = getAuthenticatedUser();
  const [datasets, setDatasets] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const headers = getAdminHeaders();
      const [datasetResponse, meetingResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/client-datasets`, { headers }),
        axios.get(`${API_BASE_URL}/api/meetings`, { headers }),
      ]);
      setDatasets(Array.isArray(datasetResponse.data) ? datasetResponse.data : []);
      setMeetings(Array.isArray(meetingResponse.data) ? meetingResponse.data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load your sales dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(
    () =>
      datasets.reduce((current, dataset) => {
        const summary = summaryFor(dataset);
        Object.keys(emptySummary).forEach((key) => {
          current[key] += Number(summary[key] || 0);
        });
        return current;
      }, { ...emptySummary }),
    [datasets],
  );
  const upcomingMeetings = useMemo(() => {
    const now = new Date();
    return meetings
      .filter((meeting) => {
        const value = new Date(`${meeting.meetingDate}T${meeting.meetingTime || '00:00'}`);
        return !Number.isNaN(value.getTime()) && value >= now;
      })
      .sort((left, right) =>
        `${left.meetingDate}T${left.meetingTime || '00:00'}`.localeCompare(
          `${right.meetingDate}T${right.meetingTime || '00:00'}`,
        ),
      )
      .slice(0, 4);
  }, [meetings]);

  const cards = [
    {
      label: 'Assigned leads',
      value: totals.assignedRows,
      note: `${totals.totalRows} visible records`,
      icon: UsersRound,
      tone: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Follow-ups due',
      value: totals.followUpRows,
      note: 'Needs your attention',
      icon: Clock3,
      tone: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Interested',
      value: totals.interestedRows,
      note: 'Ready for meeting',
      icon: Flame,
      tone: 'bg-orange-50 text-orange-700',
    },
    {
      label: 'Converted',
      value: totals.convertedRows,
      note: 'Closed successfully',
      icon: CheckCircle2,
      tone: 'bg-emerald-50 text-emerald-700',
    },
  ];

  return (
    <div className="mx-auto max-w-[96rem] space-y-5">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-lg">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
              {formatRole(user?.roleKey || user?.crmRole || 'sales')}
            </p>
            <h1 className="mt-2 text-2xl font-semibold">Welcome, {user?.name || 'Sales Team'}</h1>
            <p className="mt-2 max-w-2xl text-sm text-blue-100">
              Your leads, follow-ups, interested clients and upcoming meetings in one view.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={refreshing}
              onClick={() => load({ silent: true })}
              className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/15 disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            <Link
              to="/dashboard/clients"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700"
            >
              Open Sales Data <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, note, icon: Icon, tone }) => (
          <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
              <Icon size={18} />
            </span>
            {loading ? (
              <div className="mt-4 h-8 w-16 animate-pulse rounded bg-slate-200" />
            ) : (
              <p className="mt-4 text-3xl font-semibold text-slate-950">{value}</p>
            )}
            <p className="mt-1 text-sm font-semibold text-slate-800">{label}</p>
            <p className="mt-1 text-xs text-slate-500">{note}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-950">My sales lists</h2>
              <p className="mt-1 text-xs text-slate-500">Latest datasets available in your scope</p>
            </div>
            <Target size={19} className="text-blue-600" />
          </div>
          <div className="divide-y divide-slate-100">
            {datasets.slice(0, 5).map((dataset) => {
              const summary = summaryFor(dataset);
              const progress = summary.totalRows
                ? Math.round((summary.convertedRows / summary.totalRows) * 100)
                : 0;
              return (
                <Link
                  key={dataset._id}
                  to={`/dashboard/clients/${dataset._id}`}
                  className="block px-5 py-4 transition hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{dataset.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {summary.followUpRows} follow-ups · {summary.interestedRows} interested ·{' '}
                        {summary.convertedRows} converted
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700">{progress}% won</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                  </div>
                </Link>
              );
            })}
            {!loading && !datasets.length && (
              <p className="px-5 py-12 text-center text-sm text-slate-500">
                No sales data is assigned in your current scope.
              </p>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Upcoming meetings</h2>
              <p className="mt-1 text-xs text-slate-500">Your next client conversations</p>
            </div>
            <Link to="/dashboard/meetings" className="text-xs font-semibold text-blue-700">
              View all
            </Link>
          </div>
          <div className="space-y-3 p-4">
            {upcomingMeetings.map((meeting) => (
              <Link
                key={meeting._id}
                to={`/dashboard/meetings?meetingId=${meeting._id}`}
                className="flex gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-blue-200 hover:bg-blue-50/30"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                  <CalendarDays size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {meeting.meetingTitle || 'Client Meeting'}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {formatMeeting(meeting)}
                  </span>
                </span>
              </Link>
            ))}
            {!loading && !upcomingMeetings.length && (
              <div className="py-10 text-center">
                <CalendarDays size={26} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm text-slate-500">No upcoming meetings</p>
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
};

export default SalesDashboard;
