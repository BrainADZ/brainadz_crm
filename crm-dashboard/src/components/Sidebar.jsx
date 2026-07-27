import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserRoundCog,
  ListTodo,
  Gauge,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderKanban,
  FolderOpen,
  ReceiptText,
  ShieldCheck,
} from 'lucide-react';
import { getMyAccess } from '../services/accessApi';
import { isSuperAdminSession } from '../utils/auth';

const projectWorkItems = [
  {
    to: '/dashboard/projects',
    label: 'Projects',
    icon: FolderKanban,
  },
  {
    to: '/dashboard/tasks',
    label: 'Tasks',
    icon: ListTodo,
  },
  {
    to: '/dashboard/workload',
    label: 'Team Workload',
    icon: Gauge,
  },
];

const navItems = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    exact: true,
    icon: LayoutDashboard,
    moduleKey: 'dashboard',
  },
  {
    to: '/dashboard/clients',
    label: 'Sales / Clients',
    icon: Users,
    moduleKey: 'sales',
  },
  {
    to: '/dashboard/quotations',
    label: 'Quotations',
    icon: FileText,
    moduleKey: 'quotations',
  },
  {
    to: '/dashboard/marketing',
    label: 'Marketing',
    icon: BarChart3,
    moduleKey: 'marketing',
  },
  {
    to: '/dashboard/accounting',
    label: 'Accounting',
    icon: ReceiptText,
    moduleKey: 'accounting',
  },
  {
    id: 'project-work',
    label: 'Project Work',
    icon: FolderKanban,
    children: projectWorkItems,
    moduleKey: 'projects',
  },
  {
    to: '/dashboard/documents',
    label: 'Documents',
    icon: FolderOpen,
    moduleKey: 'documents',
  },
  {
    to: '/dashboard/employees',
    label: 'Employees',
    icon: UserRoundCog,
    moduleKey: 'employees',
  },
  {
    to: '/dashboard/meetings',
    label: 'Meetings',
    icon: CalendarDays,
    moduleKey: 'meetings',
  },
  {
    to: '/dashboard/permissions',
    label: 'Permissions',
    icon: ShieldCheck,
    moduleKey: 'permissions',
  },
  {
    to: '/dashboard/whatsapp',
    label: 'WhatsApp',
    icon: FileText,
    moduleKey: 'whatsapp',
  },
];

const Sidebar = ({ collapsed, setCollapsed }) => {
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState({});
  const [visibleModules, setVisibleModules] = useState(null);

  useEffect(() => {
    if (isSuperAdminSession()) {
      setVisibleModules(null);
      return undefined;
    }
    let active = true;
    getMyAccess()
      .then((access) => {
        if (active) setVisibleModules(access.bypass ? null : new Set(access.visibleModules || []));
      })
      .catch(() => {
        if (active) setVisibleModules(new Set(['dashboard']));
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleNavItems = useMemo(
    () => navItems.filter((item) => visibleModules === null || visibleModules.has(item.moduleKey)),
    [visibleModules],
  );

  const isActive = (item) =>
    item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);

  const toggleGroup = (groupId) => {
    setOpenGroups((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }));
  };

  return (
    <aside
      className={`app-sidebar fixed inset-y-0 left-0 z-50 flex flex-col border-r shadow-sm transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Logo Area */}
      <div className="app-sidebar-border flex h-20 items-center justify-between border-b px-3">
        <Link to="/dashboard" className="flex min-w-0 items-center gap-3">
          <img
            src="/main-logo.png"
            alt="BrainADZ"
            className={`app-sidebar-logo object-contain object-left ${collapsed ? 'h-9 w-10' : 'h-14 w-40'}`}
          />
        </Link>

        {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="app-sidebar-muted app-sidebar-hover flex h-8 w-8 items-center justify-center rounded-lg transition"
            title="Collapse sidebar"
          >
            <ChevronLeft size={18} strokeWidth={1.8} />
          </button>
        )}
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto px-2 py-5">
        {!collapsed && (
          <p className="app-sidebar-muted px-3 pb-3 text-[11px] font-medium uppercase tracking-[0.16em]">
            Workspace
          </p>
        )}

        <div className="space-y-1.5">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const groupActive = item.children?.some((child) => isActive(child));

            if (item.children) {
              const groupOpen = !collapsed && (openGroups[item.id] || groupActive);

              return (
                <div key={item.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (collapsed) {
                        setCollapsed(false);
                        setOpenGroups((current) => ({ ...current, [item.id]: true }));
                        return;
                      }

                      toggleGroup(item.id);
                    }}
                    title={collapsed ? item.label : ''}
                    className={`group flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                      collapsed ? 'justify-center' : 'gap-3'
                    } ${
                      groupActive || groupOpen
                        ? 'app-nav-active'
                        : 'app-sidebar-muted app-sidebar-hover'
                    }`}
                  >
                    <Icon size={19} strokeWidth={1.7} className="shrink-0 text-current" />

                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate text-left">{item.label}</span>
                        {groupOpen ? (
                          <ChevronDown size={16} strokeWidth={1.9} className="shrink-0" />
                        ) : (
                          <ChevronRight size={16} strokeWidth={1.9} className="shrink-0" />
                        )}
                      </>
                    )}
                  </button>

                  {groupOpen && (
                    <div className="ml-4 space-y-1 border-l border-white/10 pl-3">
                      {item.children.map((child) => {
                        const ChildIcon = child.icon;
                        const childActive = isActive(child);

                        return (
                          <Link
                            key={child.to}
                            to={child.to}
                            className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                              childActive
                                ? 'app-nav-active shadow-sm'
                                : 'app-sidebar-muted app-sidebar-hover'
                            }`}
                          >
                            <ChildIcon
                              size={17}
                              strokeWidth={1.7}
                              className={`shrink-0 ${
                                childActive ? 'text-blue-600' : 'text-current'
                              }`}
                            />
                            <span className="truncate">{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const active = isActive(item);

            return (
              <Link
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : ''}
                className={`group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  collapsed ? 'justify-center' : 'gap-3'
                } ${
                  active
                    ? 'app-nav-active shadow-sm'
                    : 'app-sidebar-muted app-sidebar-hover'
                }`}
              >
                <Icon
                  size={19}
                  strokeWidth={1.7}
                  className={`shrink-0 ${active ? 'text-blue-600' : 'text-current'}`}
                />

                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Collapse Button for Collapsed View */}
      {collapsed && (
        <div className="px-2 pb-3">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="app-sidebar-muted app-sidebar-hover flex h-10 w-full items-center justify-center rounded-xl transition"
            title="Expand sidebar"
          >
            <ChevronRight size={18} strokeWidth={1.8} />
          </button>
        </div>
      )}

      {/* User Section */}
      <div className="app-sidebar-border border-t p-2.5">
        <div
          className={`app-security-card flex items-center rounded-xl border p-2 ${
            collapsed ? 'justify-center' : 'gap-3'
          }`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <ShieldCheck size={18} />
          </span>

          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold">Enterprise Security</span>
              <span className="app-sidebar-muted block truncate text-[10px]">Role-based access</span>
            </span>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
