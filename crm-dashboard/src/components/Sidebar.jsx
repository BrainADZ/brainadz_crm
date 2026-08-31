import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserRoundCog,
  ListTodo,
  MessageSquareText,
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
import { isSalesSession, isSuperAdminSession } from '../utils/auth';

const FULL_LOGO = '/main-logo.png';
const COLLAPSED_LOGO = '/br-logo-sidebar.png';

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

const WhatsAppIcon = ({ size = 19, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21 11.5a8.5 8.5 0 0 1-12.5 7.5L3 21l2-5.3A8.5 8.5 0 1 1 21 11.5Z" />
    <path d="M8.4 7.8c.2-.4.4-.4.7-.4h.5c.2 0 .4 0 .5.4l.8 1.9c.1.3.1.5-.1.7l-.6.8c-.2.2-.2.4-.1.6.5 1 1.3 1.8 2.3 2.3.2.1.4.1.6-.1l.8-1c.2-.2.4-.3.7-.2l1.9.9c.3.1.4.3.4.5v.6c0 .3-.1.6-.4.8-.5.5-1.4.8-2.2.7-1.2-.1-2.7-.7-4.4-2.2-1.4-1.2-2.4-2.7-2.8-3.8-.4-1-.3-1.8.1-2.5Z" />
  </svg>
);

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
    to: '/dashboard/communication',
    label: 'Communication',
    icon: MessageSquareText,
    moduleKey: 'communication',
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
    icon: WhatsAppIcon,
    moduleKey: 'whatsapp',
  },
];

const Sidebar = ({ collapsed, setCollapsed }) => {
  const location = useLocation();
  const salesSession = isSalesSession();

  const [openGroups, setOpenGroups] = useState({});
  const [visibleModules, setVisibleModules] = useState(null);
  const [collapsedFlyout, setCollapsedFlyout] = useState(null);
  const [collapsedLogoError, setCollapsedLogoError] = useState(false);

  const flyoutCloseTimer = useRef(null);

  const iconStyle = {
    color: 'currentColor',
    stroke: 'currentColor',
  };

  useEffect(() => {
    if (isSuperAdminSession()) {
      setVisibleModules(null);
      return undefined;
    }

    let active = true;

    getMyAccess()
      .then((access) => {
        if (!active) return;

        setVisibleModules(
          access.bypass
            ? null
            : new Set(access.visibleModules || []),
        );
      })
      .catch(() => {
        if (active) {
          setVisibleModules(new Set(['dashboard']));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const image = new Image();

    image.onload = () => {
      setCollapsedLogoError(false);
    };

    image.onerror = () => {
      setCollapsedLogoError(true);
    };

    image.src = COLLAPSED_LOGO;
  }, []);

  useEffect(() => {
    return () => {
      if (flyoutCloseTimer.current) {
        clearTimeout(flyoutCloseTimer.current);
      }
    };
  }, []);

  const visibleNavItems = useMemo(
    () =>
      navItems
        .filter(
          (item) =>
            visibleModules === null ||
            visibleModules.has(item.moduleKey),
        )
        .map((item) =>
          salesSession && item.exact
            ? { ...item, label: 'Sales Dashboard' }
            : item,
        ),
    [salesSession, visibleModules],
  );

  const isActive = (item) => {
    if (!item?.to) return false;

    if (item.exact) {
      return location.pathname === item.to;
    }

    return location.pathname.startsWith(item.to);
  };

  const isProjectWorkRoute = projectWorkItems.some((child) =>
    isActive(child),
  );

  const clearFlyoutCloseTimer = () => {
    if (flyoutCloseTimer.current) {
      clearTimeout(flyoutCloseTimer.current);
      flyoutCloseTimer.current = null;
    }
  };

  const closeFlyoutWithDelay = () => {
    clearFlyoutCloseTimer();

    flyoutCloseTimer.current = setTimeout(() => {
      setCollapsedFlyout(null);
      flyoutCloseTimer.current = null;
    }, 220);
  };

  // Close Project Work when another service is opened.
  useEffect(() => {
    clearFlyoutCloseTimer();

    if (!isProjectWorkRoute) {
      setOpenGroups((current) => {
        if (!current['project-work']) {
          return current;
        }

        return {
          ...current,
          'project-work': false,
        };
      });
    }

    setCollapsedFlyout(null);
  }, [location.pathname, isProjectWorkRoute]);

  const toggleGroup = (groupId) => {
    setOpenGroups((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }));
  };

  const handleCollapse = () => {
    clearFlyoutCloseTimer();
    setCollapsedFlyout(null);
    setCollapsed(true);
  };

  const handleExpand = () => {
    clearFlyoutCloseTimer();
    setCollapsedFlyout(null);
    setCollapsed(false);
  };

  const getFlyoutTop = (rect) => {
    const flyoutHeight = 176;
    const screenGap = 12;

    const maximumTop =
      window.innerHeight - flyoutHeight - screenGap;

    return Math.max(
      screenGap,
      Math.min(rect.top - 4, maximumTop),
    );
  };

  const openCollapsedFlyout = (event, itemId) => {
    if (!collapsed) return;

    clearFlyoutCloseTimer();

    const rect =
      event.currentTarget.getBoundingClientRect();

    setCollapsedFlyout({
      id: itemId,
      top: getFlyoutTop(rect),
    });
  };

  return (
    <aside
      className={`app-sidebar fixed inset-y-0 left-0 z-50 flex flex-col border-r shadow-sm transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      <style>
        {`
          .premium-sidebar-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: rgba(148, 163, 184, 0.38) transparent;
            overscroll-behavior: contain;
          }

          .premium-sidebar-scrollbar::-webkit-scrollbar {
            width: 5px;
          }

          .premium-sidebar-scrollbar::-webkit-scrollbar-track {
            background: transparent;
            margin-top: 6px;
            margin-bottom: 6px;
          }

          .premium-sidebar-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(148, 163, 184, 0.30);
            border-radius: 999px;
          }

          .premium-sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(148, 163, 184, 0.55);
          }

          .premium-sidebar-scrollbar::-webkit-scrollbar-button {
            display: none;
            width: 0;
            height: 0;
          }

          .project-work-flyout {
            animation: projectWorkFlyoutIn 140ms ease-out;
            transform-origin: left center;
          }

          @keyframes projectWorkFlyoutIn {
            from {
              opacity: 0;
              transform: translateX(-5px) scale(0.985);
            }

            to {
              opacity: 1;
              transform: translateX(0) scale(1);
            }
          }
        `}
      </style>

      {/* Logo */}
      <div
        className={`app-sidebar-border flex h-20 shrink-0 items-center border-b ${
          collapsed
            ? 'justify-center px-2'
            : 'justify-between px-3'
        }`}
      >
        <Link
          to="/dashboard"
          className={`flex min-w-0 items-center ${
            collapsed
              ? 'justify-center'
              : 'gap-3'
          }`}
          onClick={() => {
            clearFlyoutCloseTimer();
            setCollapsedFlyout(null);
          }}
          title="BrainADZ"
        >
          {collapsed ? (
            <span
              className="app-nav-active flex h-11 w-11 items-center justify-center"
              style={{
                background: 'transparent',
                boxShadow: 'none',
                border: 'none',
              }}
            >
              {!collapsedLogoError ? (
                <img
                  src={COLLAPSED_LOGO}
                  alt="BrainADZ"
                  className="app-sidebar-logo block h-9 w-9 object-contain"
                  onError={() =>
                    setCollapsedLogoError(true)
                  }
                />
              ) : (
                <span
                  className="flex h-9 w-9 items-center justify-center text-lg font-extrabold"
                  style={{
                    color: 'currentColor',
                  }}
                >
                  Br
                </span>
              )}
            </span>
          ) : (
            <img
              src={FULL_LOGO}
              alt="BrainADZ"
              className="app-sidebar-logo h-14 w-40 object-contain object-left"
            />
          )}
        </Link>

        {!collapsed && (
          <button
            type="button"
            onClick={handleCollapse}
            className="app-sidebar-muted app-sidebar-hover flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition"
            title="Collapse sidebar"
          >
            <ChevronLeft
              size={18}
              strokeWidth={1.8}
              className="shrink-0 text-current"
              style={iconStyle}
            />
          </button>
        )}
      </div>

      {/* Menu */}
      <nav className="premium-sidebar-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-5">
        {!collapsed && (
          <p className="app-sidebar-muted px-3 pb-3 text-[11px] font-medium uppercase tracking-[0.16em]">
            Workspace
          </p>
        )}

        <div className="space-y-1.5">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;

            if (item.children) {
              const groupActive = item.children.some(
                (child) => isActive(child),
              );

              const groupOpen =
                !collapsed &&
                (
                  openGroups[item.id] ||
                  groupActive
                );

              const flyoutOpen =
                collapsed &&
                collapsedFlyout?.id === item.id;

              return (
                <div
                  key={item.id}
                  className="relative space-y-1"
                  onMouseEnter={(event) => {
                    if (!collapsed) return;

                    openCollapsedFlyout(
                      event,
                      item.id,
                    );
                  }}
                  onMouseLeave={() => {
                    if (collapsed) {
                      closeFlyoutWithDelay();
                    }
                  }}
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      if (collapsed) {
                        clearFlyoutCloseTimer();

                        const rect =
                          event.currentTarget.getBoundingClientRect();

                        setCollapsedFlyout(
                          (current) => {
                            if (
                              current?.id === item.id
                            ) {
                              return null;
                            }

                            return {
                              id: item.id,
                              top: getFlyoutTop(rect),
                            };
                          },
                        );

                        return;
                      }

                      toggleGroup(item.id);
                    }}
                    title={
                      collapsed
                        ? item.label
                        : ''
                    }
                    className={`group flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                      collapsed
                        ? 'justify-center'
                        : 'gap-3'
                    } ${
                      groupActive ||
                      groupOpen ||
                      flyoutOpen
                        ? 'app-nav-active shadow-sm'
                        : 'app-sidebar-muted app-sidebar-hover'
                    }`}
                  >
                    <Icon
                      size={19}
                      strokeWidth={1.7}
                      className="shrink-0 text-current"
                      style={iconStyle}
                    />

                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate text-left">
                          {item.label}
                        </span>

                        {groupOpen ? (
                          <ChevronDown
                            size={16}
                            strokeWidth={1.9}
                            className="shrink-0 text-current"
                            style={iconStyle}
                          />
                        ) : (
                          <ChevronRight
                            size={16}
                            strokeWidth={1.9}
                            className="shrink-0 text-current"
                            style={iconStyle}
                          />
                        )}
                      </>
                    )}
                  </button>

                  {groupOpen && (
                    <div className="ml-4 space-y-1 border-l border-white/10 pl-3">
                      {item.children.map(
                        (child) => {
                          const ChildIcon =
                            child.icon;

                          const childActive =
                            isActive(child);

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
                                className="shrink-0 text-current"
                                style={iconStyle}
                              />

                              <span className="truncate">
                                {child.label}
                              </span>
                            </Link>
                          );
                        },
                      )}
                    </div>
                  )}

                  {flyoutOpen &&
                    typeof document !==
                      'undefined' &&
                    createPortal(
                      <div
                        className="app-sidebar project-work-flyout fixed z-[9999] w-56 rounded-xl border p-2 shadow-2xl"
                        style={{
                          left: '60px',
                          top:
                            collapsedFlyout.top,
                          pointerEvents: 'auto',
                        }}
                        onMouseEnter={() => {
                          clearFlyoutCloseTimer();
                        }}
                        onMouseLeave={() => {
                          closeFlyoutWithDelay();
                        }}
                      >
                        <div className="app-sidebar-muted px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
                          {item.label}
                        </div>

                        <div className="space-y-1">
                          {item.children.map(
                            (child) => {
                              const ChildIcon =
                                child.icon;

                              const childActive =
                                isActive(child);

                              return (
                                <Link
                                  key={child.to}
                                  to={child.to}
                                  onMouseEnter={() => {
                                    clearFlyoutCloseTimer();
                                  }}
                                  onClick={() => {
                                    clearFlyoutCloseTimer();

                                    setCollapsedFlyout(
                                      null,
                                    );
                                  }}
                                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                                    childActive
                                      ? 'app-nav-active shadow-sm'
                                      : 'app-sidebar-muted app-sidebar-hover'
                                  }`}
                                >
                                  <ChildIcon
                                    size={18}
                                    strokeWidth={1.7}
                                    className="shrink-0 text-current"
                                    style={
                                      iconStyle
                                    }
                                  />

                                  <span className="truncate">
                                    {
                                      child.label
                                    }
                                  </span>
                                </Link>
                              );
                            },
                          )}
                        </div>
                      </div>,
                      document.body,
                    )}
                </div>
              );
            }

            const active = isActive(item);

            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => {
                  clearFlyoutCloseTimer();
                  setCollapsedFlyout(null);
                }}
                title={
                  collapsed
                    ? item.label
                    : ''
                }
                className={`group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  collapsed
                    ? 'justify-center'
                    : 'gap-3'
                } ${
                  active
                    ? 'app-nav-active shadow-sm'
                    : 'app-sidebar-muted app-sidebar-hover'
                }`}
              >
                <Icon
                  size={19}
                  strokeWidth={1.7}
                  className="shrink-0 text-current"
                  style={iconStyle}
                />

                {!collapsed && (
                  <span className="truncate">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Expand */}
      {collapsed && (
        <div className="shrink-0 px-2 pb-3">
          <button
            type="button"
            onClick={handleExpand}
            className="app-sidebar-muted app-sidebar-hover flex h-10 w-full items-center justify-center rounded-xl transition"
            title="Expand sidebar"
          >
            <ChevronRight
              size={18}
              strokeWidth={1.8}
              className="shrink-0 text-current"
              style={iconStyle}
            />
          </button>
        </div>
      )}

      {/* User */}
      <div className="app-sidebar-border shrink-0 border-t p-2.5">
        <div
          className={`app-security-card flex items-center rounded-xl border p-2 ${
            collapsed
              ? 'justify-center'
              : 'gap-3'
          }`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <ShieldCheck
              size={18}
              strokeWidth={1.7}
            />
          </span>

          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold">
                Enterprise Security
              </span>

              <span className="app-sidebar-muted block truncate text-[10px]">
                Role-based access
              </span>
            </span>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
