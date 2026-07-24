import { useCallback, useEffect, useMemo, useState } from 'react';
import { FolderKanban, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  createBusinessResource,
  deleteBusinessResource,
  listBusinessResource,
  updateBusinessResource,
} from '../services/businessApi';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const labelClass = 'mb-1.5 block text-xs font-bold text-slate-600';
const iconButtonClass =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100 hover:text-blue-700';

const projectStages = [
  'Requirement Received',
  'SOW Drafting',
  'SOW Approved',
  'WBS Created',
  'Design Phase',
  'Development Phase',
  'Testing Phase',
  'Client Review',
  'Changes Requested',
  'Final Delivery',
  'Closed',
];

const taskStatuses = ['Backlog', 'To Do', 'In Progress', 'Review', 'Complete'];
const priorities = ['High', 'Medium', 'Low'];

const emptyProject = {
  name: '',
  client: '',
  owner: 'Project Manager',
  ownerEmail: '',
  deadline: '',
  priority: 'Medium',
  stage: 'Requirement Received',
  health: 'Healthy',
  progress: 0,
  notes: '',
};

const emptyTask = {
  project: '',
  name: '',
  assignee: '',
  assigneeEmail: '',
  team: 'Delivery',
  due: new Date().toISOString().slice(0, 10),
  status: 'To Do',
  progress: 0,
  dependency: '',
  priority: 'Medium',
  milestone: false,
};

const Stat = ({ label, value, note }) => (
  <div className="rounded-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
    <p className="mt-1 text-xs font-semibold text-slate-500">{note}</p>
  </div>
);

const ProjectsHub = () => {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [projectForm, setProjectForm] = useState(emptyProject);
  const [taskForm, setTaskForm] = useState(emptyTask);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('tasks');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [projectRows, taskRows] = await Promise.all([
        listBusinessResource('projects'),
        listBusinessResource('project-tasks'),
      ]);
      setProjects(projectRows);
      setTasks(taskRows);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load projects');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const active = projects.filter((project) => project.stage !== 'Closed').length;
    const overdue = tasks.filter(
      (task) => task.due && task.due < today && task.status !== 'Complete',
    ).length;
    const complete = tasks.filter((task) => task.status === 'Complete').length;
    const milestones = tasks.filter((task) => task.milestone).length;

    return [
      { label: 'Projects', value: projects.length, note: `${active} active` },
      { label: 'Tasks', value: tasks.length, note: `${complete} complete` },
      { label: 'Overdue', value: overdue, note: 'Open tasks past due' },
      { label: 'Milestones', value: milestones, note: 'Tracked key tasks' },
    ];
  }, [projects, tasks]);

  const handleProjectChange = (name, value) => {
    setProjectForm((previous) => ({ ...previous, [name]: value }));
    setMessage('');
    setError('');
  };

  const handleTaskChange = (name, value) => {
    setTaskForm((previous) => ({ ...previous, [name]: value }));
    setMessage('');
    setError('');
  };

  const submitProject = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await createBusinessResource('projects', projectForm);
      setProjects((previous) => [response.item, ...previous]);
      setProjectForm(emptyProject);
      setProjectModalOpen(false);
      setMessage(response.message || 'Project created successfully');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create project');
    } finally {
      setIsSaving(false);
    }
  };

  const submitTask = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage('');
    setError('');
    try {
      const project = projects.find((item) => item._id === taskForm.project);
      const response = await createBusinessResource('project-tasks', {
        ...taskForm,
        projectName: project?.name || '',
      });
      setTasks((previous) => [response.item, ...previous]);
      setTaskForm(emptyTask);
      setTaskModalOpen(false);
      setMessage(response.message || 'Task created successfully');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create task');
    } finally {
      setIsSaving(false);
    }
  };

  const updateTask = async (task, patch) => {
    setMessage('');
    setError('');
    try {
      const response = await updateBusinessResource('project-tasks', task._id, patch);
      setTasks((previous) =>
        previous.map((item) => (item._id === task._id ? response.item : item)),
      );
      setMessage('Task updated');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update task');
    }
  };

  const deleteItem = async (resource, item, setter) => {
    const label = item.name || item.projectName || 'record';
    if (!window.confirm(`Delete ${label}?`)) return;
    setMessage('');
    setError('');
    try {
      const response = await deleteBusinessResource(resource, item._id);
      setter((previous) => previous.filter((current) => current._id !== item._id));
      setMessage(response.message || 'Record deleted');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete record');
    }
  };

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
            <FolderKanban size={20} strokeWidth={1.9} />
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-500">Delivery and work management</p>
            <h1 className="text-2xl font-bold text-slate-950">Projects</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Create client projects, assign tasks, track stages, deadlines, milestones, health and
              progress from MongoDB.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setProjectModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
          >
            <Plus size={16} strokeWidth={1.9} />
            Create Project
          </button>
          <button
            type="button"
            onClick={() => setTaskModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
          >
            <Plus size={16} strokeWidth={1.9} />
            Assign Task
          </button>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
          >
            <RefreshCw size={16} strokeWidth={1.9} />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Stat key={stat.label} {...stat} />
        ))}
      </section>

      {(message || error) && (
        <p
          className={`rounded-lg border px-4 py-3 text-sm font-bold ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
        >
          {error || message}
        </p>
      )}

      <section>
        <section className="overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-300 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-950">
                {activeTab === 'tasks' ? 'Project Tasks' : 'Project List'}
              </h2>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Update task progress and status inline.
              </p>
            </div>
            <div className="flex rounded-full border border-slate-300 p-1">
              {['tasks', 'projects'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'tasks' ? (
            <div className="overflow-x-auto">
              <table className="min-w-[74rem] w-full table-fixed border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    {[
                      'Task',
                      'Project',
                      'Assignee',
                      'Due',
                      'Status',
                      'Priority',
                      'Progress',
                      'Action',
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="border-b border-r border-slate-300 px-4 py-2 font-bold last:border-r-0"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task._id} className="bg-white transition hover:bg-blue-50/40">
                      <td className="border-b border-r border-slate-200 px-4 py-3 font-bold text-blue-700">
                        {task.name}
                      </td>
                      <td className="border-b border-r border-slate-200 px-4 py-3">
                        {task.projectName || '-'}
                      </td>
                      <td className="border-b border-r border-slate-200 px-4 py-3">
                        {task.assignee || '-'}
                      </td>
                      <td className="border-b border-r border-slate-200 px-4 py-3">
                        {task.due || '-'}
                      </td>
                      <td className="border-b border-r border-slate-200 px-4 py-3">
                        <select
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-bold"
                          value={task.status}
                          onChange={(event) =>
                            updateTask(task, {
                              status: event.target.value,
                              progress: event.target.value === 'Complete' ? 100 : task.progress,
                            })
                          }
                        >
                          {taskStatuses.map((status) => (
                            <option key={status}>{status}</option>
                          ))}
                        </select>
                      </td>
                      <td className="border-b border-r border-slate-200 px-4 py-3">
                        {task.priority}
                      </td>
                      <td className="border-b border-r border-slate-200 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={task.progress}
                            onChange={(event) =>
                              updateTask(task, {
                                progress: Math.max(0, Math.min(100, Number(event.target.value))),
                              })
                            }
                            className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-xs font-bold"
                          />
                          <div className="h-1.5 w-20 rounded-full bg-slate-100">
                            <div
                              className="h-1.5 rounded-full bg-blue-600"
                              style={{ width: `${task.progress || 0}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-slate-200 px-4 py-3">
                        <button
                          type="button"
                          className={iconButtonClass}
                          onClick={() => deleteItem('project-tasks', task, setTasks)}
                          title="Delete task"
                        >
                          <Trash2 size={15} strokeWidth={1.9} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!isLoading && tasks.length === 0 && (
                    <tr>
                      <td
                        colSpan="8"
                        className="px-4 py-16 text-center text-sm font-semibold text-slate-500"
                      >
                        No project tasks found.
                      </td>
                    </tr>
                  )}
                  {isLoading && (
                    <tr>
                      <td
                        colSpan="8"
                        className="px-4 py-16 text-center text-sm font-semibold text-slate-500"
                      >
                        Loading projects...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[64rem] w-full table-fixed border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    {[
                      'Project',
                      'Client',
                      'Owner',
                      'Stage',
                      'Health',
                      'Deadline',
                      'Progress',
                      'Action',
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="border-b border-r border-slate-300 px-4 py-2 font-bold last:border-r-0"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project._id} className="bg-white transition hover:bg-blue-50/40">
                      <td className="border-b border-r border-slate-200 px-4 py-3 font-bold text-blue-700">
                        {project.name}
                      </td>
                      <td className="border-b border-r border-slate-200 px-4 py-3">
                        {project.client}
                      </td>
                      <td className="border-b border-r border-slate-200 px-4 py-3">
                        {project.owner}
                      </td>
                      <td className="border-b border-r border-slate-200 px-4 py-3">
                        {project.stage}
                      </td>
                      <td className="border-b border-r border-slate-200 px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                          {project.health}
                        </span>
                      </td>
                      <td className="border-b border-r border-slate-200 px-4 py-3">
                        {project.deadline || '-'}
                      </td>
                      <td className="border-b border-r border-slate-200 px-4 py-3">
                        {project.progress || 0}%
                      </td>
                      <td className="border-b border-slate-200 px-4 py-3">
                        <button
                          type="button"
                          className={iconButtonClass}
                          onClick={() => deleteItem('projects', project, setProjects)}
                          title="Delete project"
                        >
                          <Trash2 size={15} strokeWidth={1.9} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!isLoading && projects.length === 0 && (
                    <tr>
                      <td
                        colSpan="8"
                        className="px-4 py-16 text-center text-sm font-semibold text-slate-500"
                      >
                        No projects found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>

      {projectModalOpen && (
        <FormModal title="Create Project" onClose={() => setProjectModalOpen(false)}>
          <form onSubmit={submitProject} className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className={labelClass}>Project name</span>
                <input
                  className={inputClass}
                  value={projectForm.name}
                  onChange={(event) => handleProjectChange('name', event.target.value)}
                  required
                />
              </label>
              <label>
                <span className={labelClass}>Client</span>
                <input
                  className={inputClass}
                  value={projectForm.client}
                  onChange={(event) => handleProjectChange('client', event.target.value)}
                  required
                />
              </label>
              <label>
                <span className={labelClass}>Owner</span>
                <input
                  className={inputClass}
                  value={projectForm.owner}
                  onChange={(event) => handleProjectChange('owner', event.target.value)}
                />
              </label>
              <label>
                <span className={labelClass}>Deadline</span>
                <input
                  type="date"
                  className={inputClass}
                  value={projectForm.deadline}
                  onChange={(event) => handleProjectChange('deadline', event.target.value)}
                />
              </label>
              <label>
                <span className={labelClass}>Priority</span>
                <select
                  className={inputClass}
                  value={projectForm.priority}
                  onChange={(event) => handleProjectChange('priority', event.target.value)}
                >
                  {priorities.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelClass}>Health</span>
                <select
                  className={inputClass}
                  value={projectForm.health}
                  onChange={(event) => handleProjectChange('health', event.target.value)}
                >
                  {['Healthy', 'At Risk', 'Blocked', 'Closed'].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelClass}>Stage</span>
                <select
                  className={inputClass}
                  value={projectForm.stage}
                  onChange={(event) => handleProjectChange('stage', event.target.value)}
                >
                  {projectStages.map((stage) => (
                    <option key={stage}>{stage}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelClass}>Progress</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className={inputClass}
                  value={projectForm.progress}
                  onChange={(event) => handleProjectChange('progress', Number(event.target.value))}
                />
              </label>
              <label className="sm:col-span-2">
                <span className={labelClass}>Notes</span>
                <textarea
                  className={`${inputClass} min-h-24 resize-y`}
                  value={projectForm.notes}
                  onChange={(event) => handleProjectChange('notes', event.target.value)}
                />
              </label>
            </div>
            <ModalActions
              onCancel={() => setProjectModalOpen(false)}
              isSaving={isSaving}
              submitLabel="Create Project"
            />
          </form>
        </FormModal>
      )}

      {taskModalOpen && (
        <FormModal title="Assign Task" onClose={() => setTaskModalOpen(false)}>
          <form onSubmit={submitTask} className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className={labelClass}>Project</span>
                <select
                  className={inputClass}
                  value={taskForm.project}
                  onChange={(event) => handleTaskChange('project', event.target.value)}
                  required
                >
                  <option value="">Select project</option>
                  {projects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sm:col-span-2">
                <span className={labelClass}>Task name</span>
                <input
                  className={inputClass}
                  value={taskForm.name}
                  onChange={(event) => handleTaskChange('name', event.target.value)}
                  required
                />
              </label>
              <label>
                <span className={labelClass}>Assignee</span>
                <input
                  className={inputClass}
                  value={taskForm.assignee}
                  onChange={(event) => handleTaskChange('assignee', event.target.value)}
                />
              </label>
              <label>
                <span className={labelClass}>Due</span>
                <input
                  type="date"
                  className={inputClass}
                  value={taskForm.due}
                  onChange={(event) => handleTaskChange('due', event.target.value)}
                />
              </label>
              <label>
                <span className={labelClass}>Status</span>
                <select
                  className={inputClass}
                  value={taskForm.status}
                  onChange={(event) => handleTaskChange('status', event.target.value)}
                >
                  {taskStatuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelClass}>Priority</span>
                <select
                  className={inputClass}
                  value={taskForm.priority}
                  onChange={(event) => handleTaskChange('priority', event.target.value)}
                >
                  {priorities.map((priority) => (
                    <option key={priority}>{priority}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelClass}>Progress</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className={inputClass}
                  value={taskForm.progress}
                  onChange={(event) => handleTaskChange('progress', Number(event.target.value))}
                />
              </label>
              <label>
                <span className={labelClass}>Dependency</span>
                <input
                  className={inputClass}
                  value={taskForm.dependency}
                  onChange={(event) => handleTaskChange('dependency', event.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={taskForm.milestone}
                  onChange={(event) => handleTaskChange('milestone', event.target.checked)}
                />{' '}
                Mark as milestone
              </label>
            </div>
            <ModalActions
              onCancel={() => setTaskModalOpen(false)}
              isSaving={isSaving}
              submitLabel="Assign Task"
            />
          </form>
        </FormModal>
      )}
    </div>
  );
};

const FormModal = ({ title, children, onClose }) => (
  <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
    <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">
            Project workflow
          </p>
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        </div>
        <button type="button" onClick={onClose} className={iconButtonClass} aria-label="Close form">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 fill-none stroke-current"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      {children}
    </section>
  </div>
);

const ModalActions = ({ onCancel, isSaving, submitLabel }) => (
  <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
    <button
      type="button"
      onClick={onCancel}
      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
    >
      Cancel
    </button>
    <button
      type="submit"
      disabled={isSaving}
      className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:bg-slate-300"
    >
      {isSaving ? 'Saving...' : submitLabel}
    </button>
  </div>
);

export default ProjectsHub;
