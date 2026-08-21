import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  BriefcaseBusiness,
  FileText,
  FolderKanban,
  MessageSquareText,
  ReceiptText,
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
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon size={20} strokeWidth={1.9} />
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Live DB
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xs font-medium text-slate-500">{note}</p>
    </article>
  );
};

const RecentList = ({ title, rows, empty, renderRow, to }) => (
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b border-slate-300 px-4 py-3">
      <div>
        <h2 className="text-base font-bold text-slate-950">{title}</h2>
        <p className="mt-1 text-xs font-medium text-slate-500">Latest records from MongoDB.</p>
      </div>
      {to && (
        <Link
          to={to}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
        >
          Open
        </Link>
      )}
    </div>
    <div className="divide-y divide-slate-100">
      {rows?.length ? (
        rows.map(renderRow)
      ) : (
        <p className="px-4 py-10 text-center text-sm font-semibold text-slate-500">{empty}</p>
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
    const marketing = summary?.marketing || {};
    const accounting = summary?.accounting || {};
    const projects = summary?.projects || {};

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
        label: 'Campaign ROI',
        value: `${Number(marketing.avgRoi || 0).toFixed(1)}x`,
        note: `${money(marketing.spend)} spend, ${marketing.leads || 0} leads`,
        icon: BarChart3,
        tone: 'violet',
      },
      {
        label: 'Pending collection',
        value: money(accounting.pending),
        note: `${accounting.invoices || 0} invoices, ${money(accounting.overdue)} overdue`,
        icon: ReceiptText,
        tone: accounting.overdue > 0 ? 'rose' : 'amber',
      },
      {
        label: 'Active projects',
        value: projects.active || 0,
        note: `${projects.overdueTasks || 0} overdue tasks`,
        icon: FolderKanban,
        tone: projects.overdueTasks > 0 ? 'rose' : 'green',
      },
      {
        label: 'Documents',
        value: summary?.documents || 0,
        note: `${summary?.communications || 0} communication logs`,
        icon: FileText,
        tone: 'slate',
      },
    ];
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

      <section className="grid gap-4 xl:grid-cols-2">
        <RecentList
          title="Recent Projects"
          rows={summary?.recent?.projects || []}
          empty="No projects yet."
          to="/dashboard/projects"
          renderRow={(project) => (
            <div key={project._id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">{project.name}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    {project.client} - {project.stage}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                  {project.progress || 0}%
                </span>
              </div>
            </div>
          )}
        />

        <RecentList
          title="Recent Communications"
          rows={summary?.recent?.communications || []}
          empty="No communications logged yet."
          to="/dashboard/communication"
          renderRow={(item) => (
            <div key={item._id} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <MessageSquareText size={16} strokeWidth={1.9} />
              </span>
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-900">{item.clientName}</p>
                <p className="mt-1 truncate text-xs font-medium text-slate-500">
                  {item.channel} - {item.type} - {item.message}
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
