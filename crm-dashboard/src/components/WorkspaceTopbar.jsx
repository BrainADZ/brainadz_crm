import { Search } from 'lucide-react';
import NotificationBell from './NotificationBell';
import UserProfileMenu from './UserProfileMenu';

const WorkspaceTopbar = ({ title, role, showSearch = true }) => (
  <header className="app-topbar sticky top-0 z-40 flex h-20 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-7">
    <div className="min-w-0 sm:w-32">
      <h1 className="truncate text-sm font-semibold text-slate-500">{title}</h1>
    </div>

    <div className="ml-auto flex items-center gap-3 sm:ml-0 sm:flex-1 sm:justify-end">
      {showSearch && (
        <label className="relative mr-auto hidden sm:block sm:w-full sm:max-w-md">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search size={16} strokeWidth={1.8} />
          </span>

          <input
            type="search"
            placeholder="Search records, people, projects..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>
      )}

      {showSearch && (
        <button
          type="button"
          title="Search records"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 sm:hidden"
        >
          <Search size={18} strokeWidth={1.8} />
        </button>
      )}

      <NotificationBell role={role} />
      <UserProfileMenu role={role} />
    </div>
  </header>
);

export default WorkspaceTopbar;
