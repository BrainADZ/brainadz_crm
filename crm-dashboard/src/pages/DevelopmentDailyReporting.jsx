import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, RefreshCw, Save } from 'lucide-react';
import {
  listBusinessResource,
  listDevelopmentDailyReports,
  getMyProfile,
  saveDevelopmentDailyReport,
} from '../services/businessApi';
import { getCurrentCommunityKey } from '../utils/auth';
import { isDevelopmentProject, isDevelopmentTask, isMyTask } from '../utils/developmentTracker';

const localDateKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const emptyForm = () => ({
  completedWork: '',
  blockers: '',
  nextPlan: '',
  hoursWorked: '',
  taskIds: [],
});

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const DevelopmentDailyReporting = () => {
  const [date, setDate] = useState(localDateKey);
  const [form, setForm] = useState(emptyForm);
  const [reports, setReports] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [reportRows, projectRows, taskRows, profile] = await Promise.all([
        listDevelopmentDailyReports(),
        listBusinessResource('projects'),
        listBusinessResource('project-tasks'),
        getMyProfile(),
      ]);
      const projectIds = new Set(
        projectRows.filter(isDevelopmentProject).map((project) => String(project._id)),
      );
      const communityKey = getCurrentCommunityKey();
      setReports(reportRows || []);
      setTasks(
        (taskRows || []).filter(
          (task) =>
            isDevelopmentTask(task, projectIds) &&
            (!communityKey || task.communityKey === communityKey) &&
            isMyTask(task, profile),
        ),
      );
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load daily reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedReport = useMemo(
    () => reports.find((report) => report.reportDate === date),
    [date, reports],
  );

  useEffect(() => {
    setForm(
      selectedReport
        ? {
            completedWork: selectedReport.completedWork || '',
            blockers: selectedReport.blockers || '',
            nextPlan: selectedReport.nextPlan || '',
            hoursWorked: String(selectedReport.hoursWorked ?? ''),
            taskIds: (selectedReport.taskIds || []).map(String),
          }
        : emptyForm(),
    );
  }, [selectedReport]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await saveDevelopmentDailyReport(date, {
        ...form,
        hoursWorked: Number(form.hoursWorked || 0),
      });
      setReports((current) =>
        [response.item, ...current.filter((report) => report._id !== response.item._id)].sort(
          (first, second) => second.reportDate.localeCompare(first.reportDate),
        ),
      );
      setMessage('Daily report saved.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save daily report');
    } finally {
      setSaving(false);
    }
  };

  const toggleTask = (taskId) => {
    setForm((current) => ({
      ...current,
      taskIds: current.taskIds.includes(taskId)
        ? current.taskIds.filter((id) => id !== taskId)
        : [...current.taskIds, taskId],
    }));
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
            Development team tracker
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Daily Reporting</h1>
          <p className="mt-2 text-sm text-slate-500">
            Record what you worked on each day and review your own reports.
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </header>

      {(error || message) && (
        <p
          className={`rounded-lg border px-4 py-3 text-sm font-semibold ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
        >
          {error || message}
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <form
          onSubmit={save}
          className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                {selectedReport ? 'Edit report' : 'Write report'}
              </h2>
              <p className="text-xs text-slate-500">
                One report per day. Saving again updates that day.
              </p>
            </div>
            <label className="text-xs font-bold text-slate-600">
              Report date
              <input
                type="date"
                value={date}
                max={localDateKey()}
                onChange={(event) => setDate(event.target.value)}
                required
                className={`${inputClass} mt-1`}
              />
            </label>
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            Work completed / progress today
            <textarea
              value={form.completedWork}
              onChange={(event) =>
                setForm((current) => ({ ...current, completedWork: event.target.value }))
              }
              required
              maxLength={5000}
              rows={5}
              placeholder="Describe the development work, result and current state"
              className={`${inputClass} mt-1 resize-y`}
            />
          </label>
          <div>
            <p className="text-sm font-semibold text-slate-700">Related tasks</p>
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {tasks.map((task) => (
                <label
                  key={task._id}
                  className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={form.taskIds.includes(String(task._id))}
                    onChange={() => toggleTask(String(task._id))}
                    className="mt-1"
                  />
                  <span>
                    <strong>{task.name}</strong>
                    <span className="block text-xs text-slate-500">
                      {task.projectName || 'General task'} · {task.status}
                    </span>
                  </span>
                </label>
              ))}
              {!tasks.length && (
                <p className="px-2 py-3 text-xs text-slate-500">
                  No assigned development tasks yet. You can still submit a report.
                </p>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Blockers
              <textarea
                value={form.blockers}
                onChange={(event) =>
                  setForm((current) => ({ ...current, blockers: event.target.value }))
                }
                maxLength={3000}
                rows={3}
                placeholder="Anything blocking progress?"
                className={`${inputClass} mt-1 resize-y`}
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Next plan
              <textarea
                value={form.nextPlan}
                onChange={(event) =>
                  setForm((current) => ({ ...current, nextPlan: event.target.value }))
                }
                maxLength={3000}
                rows={3}
                placeholder="What will you work on next?"
                className={`${inputClass} mt-1 resize-y`}
              />
            </label>
          </div>
          <label className="block max-w-40 text-sm font-semibold text-slate-700">
            Hours worked
            <input
              type="number"
              min="0"
              max="24"
              step="0.25"
              value={form.hoursWorked}
              onChange={(event) =>
                setForm((current) => ({ ...current, hoursWorked: event.target.value }))
              }
              className={`${inputClass} mt-1`}
            />
          </label>
          <button
            type="submit"
            disabled={saving || loading || !date}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Save report'}
          </button>
        </form>

        <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-blue-700" />
            <h2 className="font-bold text-slate-950">My reporting history</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">Select a date to review or edit.</p>
          <div className="mt-4 max-h-[40rem] space-y-2 overflow-y-auto">
            {reports.map((report) => (
              <button
                key={report._id}
                type="button"
                onClick={() => setDate(report.reportDate)}
                className={`block w-full rounded-lg border p-3 text-left transition ${date === report.reportDate ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <span className="text-sm font-bold text-slate-900">
                  {new Date(`${report.reportDate}T00:00:00`).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                <span className="ml-2 text-xs text-slate-500">{report.hoursWorked || 0}h</span>
                <span className="mt-1 block line-clamp-2 text-xs text-slate-600">
                  {report.completedWork}
                </span>
              </button>
            ))}
            {!loading && !reports.length && (
              <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                No daily reports yet.
              </p>
            )}
            {loading && <p className="text-sm text-slate-500">Loading reports...</p>}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default DevelopmentDailyReporting;
