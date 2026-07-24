import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import WorkspaceTopbar from './WorkspaceTopbar';
import { getMyAccess } from '../services/accessApi';

const links = [
  {
    to: '/employee-dashboard',
    label: 'Home',
    exact: true,
    icon: <path d="M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-9Z" />,
  },
  {
    to: '/employee-dashboard/tasks',
    label: 'Tasks',
    icon: <path d="M9 11 12 14 22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />,
  },
  {
    to: '/employee-dashboard/datasets',
    label: 'Data',
    icon: (
      <>
        <path d="M4 4h16v16H4z" />
        <path d="M4 10h16" />
        <path d="M10 4v16" />
      </>
    ),
  },
];

const salesLink = {
  to: '/employee-dashboard/sales',
  label: 'Sales Data',
  icon: (
    <>
      <path d="M4 4h16v16H4z" />
      <path d="M4 10h16" />
      <path d="M10 4v16" />
    </>
  ),
};

const meetingsLink = {
  to: '/employee-dashboard/meetings',
  label: 'Meetings',
  icon: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
};

const quotationsLink = {
  to: '/employee-dashboard/quotations',
  label: 'Quotations',
  icon: (
    <>
      <path d="M6 2h9l5 5v15H6z" />
      <path d="M14 2v6h6M9 13h8M9 17h6" />
    </>
  ),
};

const EmployeeLayout = () => {
  const location = useLocation();
  const [visibleModules, setVisibleModules] = useState([]);
  useEffect(() => {
    getMyAccess({ refresh: true })
      .then((access) => setVisibleModules(access.visibleModules || []))
      .catch(() => setVisibleModules([]));
  }, []);
  let navigationLinks = visibleModules.includes('sales')
    ? [...links.slice(0, 2), salesLink, ...links.slice(2)]
    : [...links];
  if (visibleModules.includes('meetings'))
    navigationLinks = [...navigationLinks.slice(0, 2), meetingsLink, ...navigationLinks.slice(2)];
  if (visibleModules.includes('quotations'))
    navigationLinks = [...navigationLinks.slice(0, 2), quotationsLink, ...navigationLinks.slice(2)];
  const pageTitle = location.pathname.startsWith('/employee-dashboard/sales')
    ? 'Sales Data'
    : location.pathname.startsWith('/employee-dashboard/meetings')
      ? 'Meetings'
      : location.pathname.startsWith('/employee-dashboard/quotations')
        ? 'Quotations'
        : location.pathname.startsWith('/employee-dashboard/datasets')
          ? 'Client Data'
          : location.pathname.endsWith('/tasks')
            ? 'Tasks'
            : location.pathname.endsWith('/settings')
              ? 'Settings'
              : 'Dashboard';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-50 flex w-20 flex-col bg-slate-950 text-white shadow-xl lg:w-64">
        <Link
          to="/employee-dashboard"
          className="flex h-16 items-center gap-3 border-b border-white/10 px-4 lg:px-5"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500">
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-white" strokeWidth="2">
              <path d="M9 11 12 14 22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </span>
          <span className="hidden lg:block">
            <span className="block text-sm font-semibold">Company CRM</span>
            <span className="mt-0.5 block text-xs text-slate-400">Employee workspace</span>
          </span>
        </Link>
        <nav className="flex-1 space-y-1 px-3 py-5">
          {navigationLinks.map((link) => {
            const active = link.exact
              ? location.pathname === link.to
              : location.pathname.startsWith(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                title={link.label}
                className={`flex items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition lg:justify-start ${
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 shrink-0 fill-none stroke-current"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {link.icon}
                </svg>
                <span className="hidden lg:block">{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="min-h-screen pl-20 lg:pl-64">
        <WorkspaceTopbar
          title={pageTitle}
          role="employee"
          showSearch={!location.pathname.endsWith('/settings')}
        />
        <main className="w-full p-4 sm:p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default EmployeeLayout;
