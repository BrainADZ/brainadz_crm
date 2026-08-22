import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import NotificationBell from './NotificationBell';
import UserProfileMenu from './UserProfileMenu';
import QuickAddMenu from './QuickAddMenu';

const WorkspaceTopbar = ({ title, role, showSearch = true }) => {
  const searchRef = useRef(null);

  useEffect(() => {
    if (!showSearch) return undefined;
    const focusSearch = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, [showSearch]);

  return (
  <header className="app-topbar sticky top-0 z-40 flex h-[4.5rem] items-center gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
    <div className="min-w-0 shrink-0">
      <h1 className="ui-title truncate text-lg font-semibold">{title}</h1>
      {title === 'Dashboard' && (
        <p className="ui-muted hidden text-xs sm:block">Overview of your company activity</p>
      )}
    </div>

    <div className="ml-auto flex min-w-0 items-center gap-2 sm:flex-1 sm:justify-end">
      {showSearch && (
        <label className="relative mr-auto hidden sm:block sm:w-full sm:max-w-lg">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search size={16} strokeWidth={1.8} />
          </span>

          <input
            ref={searchRef}
            type="search"
            placeholder="Search clients, projects, quotations..."
            aria-label="Global search"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-14 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <kbd className="ui-muted pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border ui-border px-1.5 py-0.5 text-[10px] font-semibold lg:block">Ctrl K</kbd>
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

      <QuickAddMenu />
      <NotificationBell role={role} />
      <UserProfileMenu role={role} />
    </div>
  </header>
  );
};

export default WorkspaceTopbar;
