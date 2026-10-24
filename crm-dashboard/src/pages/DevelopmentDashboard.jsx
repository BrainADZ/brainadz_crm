import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, FolderKanban, LayoutDashboard, ListTodo, RefreshCw } from 'lucide-react';
import { getMyAccess } from '../services/accessApi';
import { listBusinessResource, listDevelopmentDailyReports } from '../services/businessApi';
import { isDevelopmentProject, isDevelopmentTask, isMyTask } from '../utils/developmentTracker';
import { canAccessResource } from '../utils/resourceAccess';

const localToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const DevelopmentDashboard = ({ profile }) => {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const access = await getMyAccess();
      const [projectRows, taskRows, reportRows] = await Promise.all([
        canAccessResource(access, 'projects') ? listBusinessResource('projects') : [],
        canAccessResource(access, 'tasks') ? listBusinessResource('project-tasks') : [],
        canAccessResource(access, 'daily_reports') ? listDevelopmentDailyReports() : [],
      ]);
      const myProjects = (projectRows || []).filter(isDevelopmentProject);
      const projectIds = new Set(myProjects.map((project) => String(project._id)));
      setProjects(myProjects);
      setTasks((taskRows || []).filter((task) => isDevelopmentTask(task, projectIds) && isMyTask(task, profile)));
      setReports(reportRows || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load development work');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const openTasks = tasks.filter((task) => task.status !== 'Complete');
  const reportedToday = reports.some((report) => report.reportDate === localToday());
  const links = [
    { to: '/dashboard/projects', label: 'My Projects', detail: 'Projects you are involved in', icon: FolderKanban, value: projects.length },
    { to: '/dashboard/tasks/my', label: 'My Tasks', detail: 'Work assigned to you', icon: ListTodo, value: openTasks.length },
    { to: '/dashboard/tasks/board', label: 'Workload Board', detail: 'Track task stages', icon: LayoutDashboard, value: tasks.length },
    { to: '/dashboard/daily-reporting', label: 'Daily Reporting', detail: reportedToday ? 'Today’s report submitted' : projects.length ? 'Submit today’s update' : 'Awaiting project assignment', icon: CalendarDays, value: reportedToday ? 'Done' : projects.length ? 'Pending' : '—' },
  ];

  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-[#10275c] px-6 py-6 text-white shadow-sm">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-blue-200">Development workspace</p>
        <h1 className="mt-2 text-2xl font-bold">My work</h1>
        <p className="mt-1 text-sm text-blue-100">Welcome, {profile.name}. Your projects, tasks and daily update in one place.</p>
      </div>
      <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold hover:bg-white/10"><RefreshCw size={15} /> Refresh</button>
    </header>
    {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {links.map(({ to, label, detail, icon: Icon, value }) => <Link key={to} to={to} className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md">
        <div className="flex items-start justify-between"><span className="rounded-lg bg-blue-50 p-2 text-blue-700"><Icon size={19} /></span><span className="text-xl font-bold text-slate-900">{loading ? '—' : value}</span></div>
        <h2 className="mt-4 font-bold text-slate-900 group-hover:text-blue-700">{label}</h2>
        <p className="mt-1 text-xs text-slate-500">{detail}</p>
      </Link>)}
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><h2 className="font-bold text-slate-900">My Projects</h2><Link to="/dashboard/projects" className="text-xs font-semibold text-blue-700">View all</Link></div>
        <div className="divide-y divide-slate-100">{projects.slice(0, 5).map((project) => <div key={project._id} className="flex items-center justify-between gap-3 px-4 py-3"><div><p className="text-sm font-semibold text-slate-800">{project.name}</p><p className="text-xs text-slate-500">{project.client || 'Development project'}</p></div><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{project.stage}</span></div>)}
          {!loading && !projects.length && <p className="px-4 py-8 text-center text-sm text-slate-500">No project assigned yet.</p>}
          {loading && <p className="px-4 py-8 text-center text-sm text-slate-500">Loading projects...</p>}
        </div>
      </section>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><h2 className="font-bold text-slate-900">My Open Tasks</h2><Link to="/dashboard/tasks/my" className="text-xs font-semibold text-blue-700">View all</Link></div>
        <div className="divide-y divide-slate-100">{openTasks.slice(0, 5).map((task) => <div key={task._id} className="flex items-center justify-between gap-3 px-4 py-3"><div><p className="text-sm font-semibold text-slate-800">{task.name}</p><p className="text-xs text-slate-500">{task.projectName || 'Project task'}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{task.status}</span></div>)}
          {!loading && !openTasks.length && <p className="px-4 py-8 text-center text-sm text-slate-500">No open tasks assigned.</p>}
          {loading && <p className="px-4 py-8 text-center text-sm text-slate-500">Loading tasks...</p>}
        </div>
      </section>
    </div>
  </div>;
};

export default DevelopmentDashboard;
