import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronRight, Clock3, FileDown, Plus, RefreshCw, Save, Send, Trash2 } from 'lucide-react';
import { downloadDevelopmentReportAttachment, getDevelopmentReportOptions, listDevelopmentDailyReports, listDevelopmentTeamMembers, saveDevelopmentDailyReport, uploadDevelopmentReportAttachments } from '../services/businessApi';
import { getMyAccess } from '../services/accessApi';
import { getAuthenticatedRole } from '../utils/auth';
import { canAccessResource } from '../utils/resourceAccess';

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const formatDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const blankEntry = () => ({ project: '', task: '', workType: 'Development', workSummary: '', hoursSpent: '' });
const input = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const reportEntries = (report) => report.entries?.length ? report.entries : [{
  project: report.project?._id || report.project || '',
  projectName: report.project?.name || report.projectName || 'General work',
  taskName: '', workType: 'Development', workSummary: report.completedWork || '', hoursSpent: report.hoursWorked || 0,
}];
const reportStatus = (report) => report.status === 'draft' ? 'draft' : 'submitted';
const reportHours = (report) => reportEntries(report).reduce((total, entry) => total + Number(entry.hoursSpent || 0), 0);
const projectLabel = (entry) => entry.projectName || 'General work';

function DevelopmentDailyReporting() {
  const isAdmin = getAuthenticatedRole() === 'admin';
  const [date, setDate] = useState(today);
  const [community, setCommunity] = useState('');
  const [entries, setEntries] = useState([blankEntry()]);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [files, setFiles] = useState([]);
  const [reports, setReports] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [allowGeneralReporting, setAllowGeneralReporting] = useState(false);
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filterDate, setFilterDate] = useState(today);
  const [filterProject, setFilterProject] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [openId, setOpenId] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rows, userAccess, options, people] = await Promise.all([
        listDevelopmentDailyReports(),
        isAdmin ? Promise.resolve(null) : getMyAccess(),
        isAdmin ? Promise.resolve({ projects: [], tasks: [] }) : getDevelopmentReportOptions(),
        isAdmin ? listDevelopmentTeamMembers().catch(() => []) : Promise.resolve([]),
      ]);
      setReports(rows || []);
      setAccess(userAccess);
      setProjects(options.projects || []);
      setTasks(options.tasks || []);
      setMembers(people || []);
      setAllowGeneralReporting(Boolean(options.allowGeneralReporting));
      setCommunity((current) => current || options.projects?.[0]?.communityKey || rows?.[0]?.communityKey || '');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load daily reports');
    } finally { setLoading(false); }
  }, [isAdmin]);

  useEffect(() => { loadData(); }, [loadData]);
  const selectedReport = useMemo(() => reports.find((report) => report.reportDate === date && report.communityKey === community), [reports, date, community]);
  const isLocked = Boolean(selectedReport && reportStatus(selectedReport) === 'submitted');
  const canWrite = !isAdmin && !isLocked && canAccessResource(access, 'daily_reports', selectedReport ? 'update' : 'create');
  useEffect(() => {
    setEntries(selectedReport ? reportEntries(selectedReport).map((entry) => ({
      project: String(entry.project?._id || entry.project || ''),
      task: String(entry.task?._id || entry.task || ''),
      workType: entry.workType || 'Development', workSummary: entry.workSummary || '',
      hoursSpent: String(entry.hoursSpent ?? ''),
    })) : [blankEntry()]);
    setAdditionalNotes(selectedReport?.additionalNotes || '');
    setFiles([]);
  }, [selectedReport]);
  const availableProjects = projects.filter((project) => project.communityKey === community);
  const totalHours = entries.reduce((total, entry) => total + Number(entry.hoursSpent || 0), 0);
  const updateEntry = (index, patch) => setEntries((current) => current.map((entry, position) => position === index ? { ...entry, ...patch } : entry));

  const save = async (status) => {
    setSaving(true); setError(''); setMessage('');
    try {
      const payload = {
        communityKey: community, additionalNotes,
        entries: entries.map((entry) => ({ ...entry, project: entry.project === 'general' ? '' : entry.project, hoursSpent: Number(entry.hoursSpent) })),
      };
      let response = await saveDevelopmentDailyReport(date, { ...payload, status: files.length ? 'draft' : status });
      if (files.length) {
        const uploaded = await uploadDevelopmentReportAttachments(date, response.item.communityKey, files);
        response = status === 'submitted'
          ? await saveDevelopmentDailyReport(date, { ...payload, status })
          : uploaded;
        setFiles([]);
      }
      setReports((current) => [response.item, ...current.filter((report) => report._id !== response.item._id)]
        .sort((a, b) => b.reportDate.localeCompare(a.reportDate)));
      setCommunity(response.item.communityKey);
      setMessage(status === 'draft' ? 'Draft saved. You can continue editing it.' : 'Daily report submitted. It is now read only.');
    } catch (requestError) {
      await loadData();
      setError(requestError.response?.data?.message || 'Unable to save daily report');
    } finally { setSaving(false); }
  };

  const projectNames = [...new Set(reports.flatMap((report) => reportEntries(report).map(projectLabel)))].sort();
  const filtered = reports.filter((report) => {
    if (filterDate && report.reportDate !== filterDate) return false;
    if (filterEmployee && String(report.user?._id || report.user) !== filterEmployee) return false;
    if (filterProject && !reportEntries(report).some((entry) => projectLabel(entry) === filterProject)) return false;
    if (filterStatus && reportStatus(report) !== filterStatus) return false;
    return true;
  });
  const dayReports = reports.filter((report) => report.reportDate === filterDate);
  const submittedToday = dayReports.filter((report) => reportStatus(report) === 'submitted').length;
  const draftToday = dayReports.filter((report) => reportStatus(report) === 'draft').length;
  const activeIds = new Set(dayReports.filter((report) => reportStatus(report) === 'submitted').map((report) => String(report.user?._id || report.user)));
  const notSubmitted = Math.max(0, members.length - activeIds.size);
  const exportReports = () => {
    const rows = [['Employee', 'Date', 'Status', 'Project', 'Task', 'Work Type', 'Work Summary', 'Hours', 'Additional Notes']];
    filtered.forEach((report) => reportEntries(report).forEach((entry) => rows.push([
      report.user?.name || '', report.reportDate, reportStatus(report), projectLabel(entry), entry.taskName || '',
      entry.workType, entry.workSummary, entry.hoursSpent, report.additionalNotes || '',
    ])));
    const csv = rows.map((row) => row.map((value) => {
      const cell = String(value ?? '');
      return `"${(/^[\s]*[=+\-@]/.test(cell) ? `'${cell}` : cell).replaceAll('"', '""')}"`;
    }).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `daily-reports-${filterDate || 'all'}.csv`; link.click();
    URL.revokeObjectURL(url);
  };

  return <div className="space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold text-slate-900">{isAdmin ? 'Daily Reports' : 'Daily Reporting'}</h1>
        <p className="mt-1 text-sm text-slate-500">{isAdmin ? 'View team reports with all project and task entries grouped by day.' : 'Add all the work you did today, even across different projects.'}</p></div>
      <div className="flex gap-2">{isAdmin && <button type="button" onClick={exportReports} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><FileDown size={16} /> Export reports</button>}
        <button type="button" onClick={loadData} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><RefreshCw size={16} /> Refresh</button></div>
    </header>
    {(error || message) && <p role="alert" className={`rounded-md border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error || message}</p>}
    {isAdmin ? <>
      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <label className="flex items-center gap-2 text-sm text-slate-600"><CalendarDays size={16} /><input type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} aria-label="Filter date" className={`${input} w-auto`} /></label>
        <select value={filterProject} onChange={(event) => setFilterProject(event.target.value)} aria-label="Filter project" className={`${input} w-auto min-w-36`}><option value="">All projects</option>{projectNames.map((name) => <option key={name}>{name}</option>)}</select>
        <select value={filterEmployee} onChange={(event) => setFilterEmployee(event.target.value)} aria-label="Filter employee" className={`${input} w-auto min-w-36`}><option value="">All employees</option>{[...new Map(reports.filter((report) => report.user?._id).map((report) => [String(report.user._id), report.user])).values()].map((user) => <option key={user._id} value={user._id}>{user.name}</option>)}</select>
        <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} aria-label="Filter status" className={`${input} w-auto min-w-32`}><option value="">All statuses</option><option value="submitted">Submitted</option><option value="draft">Draft</option></select>
        <button type="button" onClick={() => { setFilterProject(''); setFilterEmployee(''); setFilterStatus(''); setFilterDate(today()); }} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Reset filters</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[[dayReports.length, 'Total reports', 'bg-blue-50 text-blue-700'], [submittedToday, 'Submitted', 'bg-emerald-50 text-emerald-700'], [draftToday, 'Drafts', 'bg-amber-50 text-amber-700'], [members.length ? notSubmitted : '—', 'Not submitted', 'bg-red-50 text-red-700']].map(([value, label, color]) => <div key={label} className={`rounded-lg border border-slate-200 p-4 ${color}`}><p className="text-sm font-medium">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}
      </div>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm">
        <thead className="bg-slate-100 text-xs font-bold text-slate-600"><tr><th className="px-3 py-3">Employee</th><th className="px-3 py-3">Date</th><th className="px-3 py-3">Projects worked</th><th className="px-3 py-3">Entries</th><th className="px-3 py-3">Hours</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Details</th></tr></thead>
        <tbody>{filtered.map((report) => <AdminRow key={report._id} report={report} open={openId === report._id} onToggle={() => setOpenId((current) => current === report._id ? '' : report._id)} />)}</tbody>
      </table></div>{!loading && !filtered.length && <p className="p-8 text-center text-sm text-slate-500">No reports match these filters.</p>}{loading && <p className="p-8 text-center text-sm text-slate-500">Loading reports...</p>}</section>
    </> : <>
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4"><div><h2 className="font-bold text-slate-900">{isLocked ? 'Submitted report' : selectedReport ? 'Continue draft' : 'New daily report'}</h2><p className="text-xs text-slate-500">One report per day. Submitted reports cannot be edited.</p></div>
          <div className="flex flex-wrap gap-2"><label className="text-xs font-semibold text-slate-600">Report date<input type="date" value={date} max={today()} onChange={(event) => { setDate(event.target.value); setMessage(''); }} className={`${input} mt-1`} /></label>
            {new Set(projects.map((project) => project.communityKey)).size > 1 && <label className="text-xs font-semibold text-slate-600">Work area<select value={community} onChange={(event) => setCommunity(event.target.value)} className={`${input} mt-1`}>{[...new Set(projects.map((project) => project.communityKey))].map((key) => <option key={key}>{key}</option>)}</select></label>}</div></div>
        {isLocked && <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">Submitted on {selectedReport.submittedAt ? new Date(selectedReport.submittedAt).toLocaleString('en-IN') : formatDate(date)}. This report is read only.</p>}
        {!loading && !projects.length && <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{allowGeneralReporting ? 'No project assigned. You can report general work.' : 'No development project is assigned. Ask your manager to assign a project or task.'}</p>}
        {!canWrite && !isLocked && !loading && <p className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">Your role does not have permission to {selectedReport ? 'update this draft' : 'create reports'}.</p>}
        <fieldset disabled={!canWrite || loading || (!availableProjects.length && !allowGeneralReporting)} className="disabled:opacity-65">
          <div className="mt-4 space-y-3">{entries.map((entry, index) => <div key={index} className="rounded-lg border border-slate-200 p-3"><div className="grid gap-3 xl:grid-cols-[64px_minmax(130px,1.2fr)_minmax(130px,1.2fr)_minmax(235px,1.5fr)_minmax(180px,2fr)_95px_28px]">
            <span className="self-center rounded-md bg-blue-50 px-2 py-2 text-center text-xs font-bold text-blue-700">Entry {index + 1}</span>
            <label className="text-xs font-semibold text-slate-700">Select project *<select required value={entry.project} onChange={(event) => updateEntry(index, { project: event.target.value, task: '' })} className={`${input} mt-1`}><option value="">Choose project</option>{!availableProjects.length && allowGeneralReporting && <option value="general">General work</option>}{availableProjects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-700">Select task <span className="font-normal text-slate-400">(optional)</span><select value={entry.task} onChange={(event) => updateEntry(index, { task: event.target.value })} className={`${input} mt-1`}><option value="">Choose task</option>{tasks.filter((task) => String(task.project) === entry.project).map((task) => <option key={task._id} value={task._id}>{task.name}</option>)}</select></label>
            <div><p className="text-xs font-semibold text-slate-700">Work type *</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">{['Development', 'Testing', 'Meeting', 'Others'].map((type) => <label key={type} className="flex items-center gap-1 text-xs text-slate-600"><input type="radio" name={`workType-${index}`} checked={entry.workType === type} onChange={() => updateEntry(index, { workType: type })} className="accent-blue-600" />{type}</label>)}</div></div>
            <label className="text-xs font-semibold text-slate-700">Work summary *<textarea required rows={2} maxLength={5000} value={entry.workSummary} onChange={(event) => updateEntry(index, { workSummary: event.target.value })} placeholder="What did you complete?" className={`${input} mt-1 resize-y`} /></label>
            <label className="text-xs font-semibold text-slate-700">Hours spent *<input type="number" min="0.25" max="24" step="0.25" required value={entry.hoursSpent} onChange={(event) => updateEntry(index, { hoursSpent: event.target.value })} className={`${input} mt-1`} /></label>
            <button type="button" onClick={() => setEntries((current) => current.filter((_, position) => position !== index))} disabled={entries.length === 1} aria-label={`Remove entry ${index + 1}`} className="self-center text-red-500 disabled:opacity-30"><Trash2 size={17} /></button>
          </div></div>)}</div>
          <button type="button" onClick={() => setEntries((current) => [...current, blankEntry()])} disabled={entries.length >= 30} className="mt-3 inline-flex items-center gap-2 rounded-md border border-blue-400 px-3 py-2 text-sm font-semibold text-blue-700"><Plus size={16} /> Add another entry</button>
          <div className="mt-5 grid gap-4 border-t border-slate-200 pt-4 md:grid-cols-[180px_1fr_1fr]"><div className="rounded-lg bg-blue-50 p-3 text-blue-700"><p className="text-xs font-semibold">Total hours</p><p className="mt-1 flex items-center gap-2 text-2xl font-bold"><Clock3 size={22} />{totalHours.toLocaleString('en-IN')} hours</p></div><label className="text-xs font-semibold text-slate-700">Additional notes (optional)<textarea rows={3} maxLength={3000} value={additionalNotes} onChange={(event) => setAdditionalNotes(event.target.value)} className={`${input} mt-1 resize-y`} placeholder="Blockers, handoff or next steps" /></label><div><label className="text-xs font-semibold text-slate-700">Screenshots / files (optional)<input type="file" multiple accept=".png,.jpg,.jpeg,.pdf" onChange={(event) => setFiles([...event.target.files])} className={`${input} mt-1`} /></label><p className="mt-1 text-xs text-slate-500">Up to 3 PNG, JPG or PDF files, 2 MB each.</p>{files.length > 0 && <p className="mt-1 text-xs text-slate-600">{files.map((file) => file.name).join(', ')}</p>}</div></div>
          {totalHours > 24 && <p className="mt-2 text-sm text-red-600">Total hours cannot exceed 24.</p>}
          <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => save('draft')} disabled={saving || totalHours > 24 || files.length + (selectedReport?.attachments?.length || 0) > 3 || files.some((file) => file.size > 2 * 1024 * 1024) || !entries.every((entry) => entry.project && entry.workSummary.trim() && Number(entry.hoursSpent) > 0)} className="inline-flex items-center gap-2 rounded-md border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50"><Save size={15} /> Save draft</button><button type="button" onClick={() => save('submitted')} disabled={saving || totalHours > 24 || files.length + (selectedReport?.attachments?.length || 0) > 3 || files.some((file) => file.size > 2 * 1024 * 1024) || !entries.every((entry) => entry.project && entry.workSummary.trim() && Number(entry.hoursSpent) > 0)} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Send size={15} /> {saving ? 'Saving...' : 'Submit daily report'}</button></div>
        </fieldset>
        {!!selectedReport?.attachments?.length && <AttachmentList report={selectedReport} />}
      </section>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><h2 className="border-b border-slate-200 px-4 py-3 font-bold text-slate-900">My reporting history</h2><div className="divide-y divide-slate-100">{reports.map((report) => <button key={report._id} type="button" onClick={() => { setDate(report.reportDate); setCommunity(report.communityKey); setMessage(''); }} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-slate-50"><span className="font-semibold text-slate-800">{formatDate(report.reportDate)}</span><span className="text-slate-600">{reportEntries(report).length} entries · {reportHours(report)}h</span><Status status={reportStatus(report)} /><span className="text-blue-700">View</span></button>)}{!loading && !reports.length && <p className="p-8 text-center text-sm text-slate-500">No reports yet.</p>}{loading && <p className="p-8 text-center text-sm text-slate-500">Loading reports...</p>}</div></section>
    </>}
  </div>;
}

function Status({ status }) { return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status === 'submitted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{status === 'submitted' ? 'Submitted' : 'Draft'}</span>; }

function AttachmentList({ report }) { return <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><strong className="text-slate-600">Files:</strong>{report.attachments.map((attachment) => <button key={attachment._id} type="button" onClick={() => downloadDevelopmentReportAttachment(report._id, attachment)} className="rounded bg-blue-50 px-2 py-1 font-medium text-blue-700 hover:underline">{attachment.name}</button>)}</div>; }

function AdminRow({ report, open, onToggle }) {
  const entries = reportEntries(report);
  const projects = [...new Set(entries.map(projectLabel))];
  return <><tr className="border-t border-slate-100 hover:bg-slate-50"><td className="px-3 py-3 font-semibold text-slate-800">{report.user?.name || 'Employee'}</td><td className="px-3 py-3">{formatDate(report.reportDate)}</td><td className="px-3 py-3"><div className="flex flex-wrap gap-1">{projects.map((name) => <span key={name} className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">{name}</span>)}</div></td><td className="px-3 py-3">{entries.length}</td><td className="px-3 py-3">{reportHours(report)}h</td><td className="px-3 py-3"><Status status={reportStatus(report)} /></td><td className="px-3 py-3"><button type="button" onClick={onToggle} aria-label={`${open ? 'Hide' : 'View'} ${report.user?.name || 'employee'} report`} className="text-blue-700">{open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</button></td></tr>
    {open && <tr><td colSpan={7} className="bg-slate-50 p-3"><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead className="text-slate-500"><tr><th className="p-2">#</th><th className="p-2">Project</th><th className="p-2">Task</th><th className="p-2">Work type</th><th className="p-2">Work summary</th><th className="p-2">Hours</th></tr></thead><tbody>{entries.map((entry, index) => <tr key={index} className="border-t border-slate-200"><td className="p-2">{index + 1}</td><td className="p-2">{projectLabel(entry)}</td><td className="p-2">{entry.taskName || '—'}</td><td className="p-2">{entry.workType}</td><td className="whitespace-pre-wrap p-2">{entry.workSummary}</td><td className="p-2">{entry.hoursSpent}h</td></tr>)}</tbody></table></div>{report.additionalNotes && <p className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-600"><strong>Additional notes:</strong> {report.additionalNotes}</p>}{!!report.attachments?.length && <AttachmentList report={report} />}{!report.entries?.length && (report.blockers || report.nextPlan) && <p className="mt-2 text-xs text-slate-600">Blockers: {report.blockers || 'None'} · Next plan: {report.nextPlan || 'None'}</p>}</td></tr>}</>;
}

export default DevelopmentDailyReporting;
