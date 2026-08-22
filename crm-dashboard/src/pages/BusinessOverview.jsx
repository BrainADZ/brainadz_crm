import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BriefcaseBusiness,
  CalendarDays,
  Database,
  FileCheck2,
  RefreshCw,
  Target,
  Users,
} from 'lucide-react';
import { getBusinessSummary } from '../services/businessApi';

const money = (value) => `Rs ${Math.round(Number(value || 0)).toLocaleString('en-IN')}`;

const StatCard = ({ label, value, note, icon: Icon, tone = 'blue' }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700',
    rose: 'bg-rose-50 text-rose-700',
    slate: 'bg-slate-100 text-slate-700',
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-px hover:border-blue-200 hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon size={20} strokeWidth={1.9} />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xs font-medium text-slate-500">{note}</p>
    </article>
  );
};

const RecentList = ({ title, description, rows, empty, renderRow, to }) => (
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <div>
        <h2 className="text-base font-bold text-slate-950">{title}</h2>
        <p className="mt-1 text-xs font-medium text-slate-500">{description}</p>
      </div>
      {to && (
        <Link
          to={to}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
        >
          View all →
        </Link>
      )}
    </div>
    <div className="divide-y divide-slate-100">
      {rows?.length ? (
        rows.map(renderRow)
      ) : (
        <div className="px-4 py-7 text-center">
          <p className="text-sm font-semibold text-slate-700">{empty}</p>
          <p className="mt-1 text-xs text-slate-500">New activity will appear here automatically.</p>
        </div>
      )}
    </div>
  </section>
);

const BusinessOverview = ({ embedded = false, refreshToken = 0 }) => {
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setSummary(await getBusinessSummary());
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load business overview');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary, refreshToken]);

  const stats = useMemo(() => {
    const sales = summary?.sales || {};
    const meetings = summary?.meetingStats || {};
    const quotations = summary?.quotationStats || {};

    return [
      {
        label: 'Pipeline accounts',
        value: sales.total || 0,
        note: `${sales.converted || 0} converted, ${sales.followUps || 0} follow-ups`,
        icon: Target,
        tone: 'blue',
      },
      {
        label: 'Employees',
        value: summary?.employees || 0,
        note: 'Users available for assignments',
        icon: Users,
        tone: 'green',
      },
      {
        label: 'Conversion rate',
        value: `${sales.conversionRate || 0}%`,
        note: `${sales.converted || 0} converted accounts`,
        icon: Target,
        tone: 'violet',
      },
      {
        label: 'Quotation value',
        value: money(quotations.value),
        note: `${quotations.accepted || 0} accepted of ${quotations.total || 0}`,
        icon: FileCheck2,
        tone: 'amber',
      },
      {
        label: 'Upcoming meetings',
        value: meetings.upcoming || 0,
        note: `${meetings.today || 0} scheduled today`,
        icon: CalendarDays,
        tone: 'green',
      },
      {
        label: 'Datasets',
        value: summary?.datasets || 0,
        note: `${sales.assigned || 0} assigned rows`,
        icon: Database,
        tone: 'slate',
      },
    ];
  }, [summary]);

  const pipeline = useMemo(() => {
    const sales = summary?.sales || {};
    const total = Number(sales.total || 0);
    return [
      ['Total accounts', total],
      ['Interested', Number(sales.interested || 0)],
      ['Follow-ups', Number(sales.followUps || 0)],
      ['Converted', Number(sales.converted || 0)],
    ].map(([label, value]) => ({
      label,
      value,
      width: total ? Math.max((value / total) * 100, value ? 4 : 0) : 0,
    }));
  }, [summary]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {!embedded && (
          <div className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        )}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div
              key={item}
              className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="ui-surface flex flex-col gap-4 rounded-2xl border p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
            <BriefcaseBusiness size={22} strokeWidth={1.9} />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-600">
              {embedded ? 'Company performance' : 'Full CRM workspace'}
            </p>
            <h1 className={`${embedded ? 'text-xl' : 'text-2xl'} mt-1 font-bold text-slate-950`}>
              {embedded ? 'Business performance' : 'Business Overview'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {embedded
                ? 'Sales, marketing, collections, projects, documents, and communication in one view.'
                : 'Sales imports, marketing, accounting, projects, documents, communication, and permissions now read from backend collections.'}
            </p>
          </div>
        </div>
        {!embedded && (
          <button
            type="button"
            onClick={loadSummary}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
          >
            <RefreshCw size={16} strokeWidth={1.9} />
            Refresh
          </button>
        )}
      </section>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-950">Sales pipeline</h2>
              <p className="mt-1 text-xs text-slate-500">Current account status distribution</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {summary?.sales?.conversionRate || 0}% conversion
            </span>
          </div>
          <div className="space-y-3">
            {pipeline.map((stage) => (
              <div key={stage.label} className="grid grid-cols-[6rem_1fr_2.5rem] items-center gap-3">
                <span className="text-xs font-semibold text-slate-600">{stage.label}</span>
                <span className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className="block h-full rounded-full bg-blue-600 transition-all duration-500"
                    style={{ width: `${Math.min(stage.width, 100)}%` }}
                  />
                </span>
                <span className="text-right text-xs font-bold text-slate-800">{stage.value}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-bold text-slate-950">Quotation performance</h2>
          <p className="mt-1 text-xs text-slate-500">Accepted value from current quotations</p>
          <p className="mt-5 text-2xl font-bold text-slate-950">
            {money(summary?.quotationStats?.acceptedValue)}
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <span
              className="block h-full rounded-full bg-blue-600"
              style={{
                width: `${summary?.quotationStats?.value
                  ? Math.min((summary.quotationStats.acceptedValue / summary.quotationStats.value) * 100, 100)
                  : 0}%`,
              }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {summary?.quotationStats?.accepted || 0} accepted · {summary?.quotationStats?.sent || 0} sent
          </p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <RecentList
          title="Recent quotations"
          description="Latest quotation activity"
          rows={summary?.recent?.quotations || []}
          empty="No quotations yet"
          to="/dashboard/quotations"
          renderRow={(quotation) => (
            <div key={quotation._id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">{quotation.subject || quotation.quotationNumber}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    {quotation.clientName || 'Client'} · {quotation.status || 'Draft'}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                  {money(quotation.grandTotal)}
                </span>
              </div>
            </div>
          )}
        />

        <RecentList
          title="Upcoming meetings"
          description="Next scheduled client and team meetings"
          rows={summary?.recent?.meetings || []}
          empty="No upcoming meetings"
          to="/dashboard/meetings"
          renderRow={(item) => (
            <div key={item._id} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <CalendarDays size={16} strokeWidth={1.9} />
              </span>
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-900">
                  {item.title || item.clientName || 'Scheduled meeting'}
                </p>
                <p className="mt-1 truncate text-xs font-medium text-slate-500">
                  {item.meetingDate} · {item.meetingTime || 'Time not set'} · {item.meetingMode || 'Meeting'}
                </p>
              </div>
            </div>
          )}
        />
      </section>
    </div>
  );
};

export default BusinessOverview;
