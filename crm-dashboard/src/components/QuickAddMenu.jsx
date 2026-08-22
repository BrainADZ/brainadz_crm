import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarPlus,
  ChevronDown,
  FilePlus2,
  FolderPlus,
  ListPlus,
  Plus,
  UserPlus,
  Users,
} from 'lucide-react';
import { getMyAccess } from '../services/accessApi';
import { isSuperAdminSession } from '../utils/auth';

const actions = [
  { label: 'Add client data', to: '/dashboard/clients', moduleKey: 'sales', resource: 'clients', icon: Users },
  { label: 'Create quotation', to: '/dashboard/quotations', moduleKey: 'quotations', resource: 'quotations', icon: FilePlus2 },
  { label: 'Add project', to: '/dashboard/projects', moduleKey: 'projects', resource: 'projects', icon: FolderPlus },
  { label: 'Create task', to: '/dashboard/tasks', moduleKey: 'projects', resource: 'projects', icon: ListPlus },
  { label: 'Schedule meeting', to: '/dashboard/meetings', moduleKey: 'meetings', resource: 'meetings', icon: CalendarPlus },
  { label: 'Add employee', to: '/dashboard/employees', moduleKey: 'employees', resource: 'employees', icon: UserPlus },
];

const QuickAddMenu = () => {
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [visibleModules, setVisibleModules] = useState(() =>
    isSuperAdminSession() ? null : new Set(),
  );
  const [creatableResources, setCreatableResources] = useState(() =>
    isSuperAdminSession() ? null : new Set(),
  );

  useEffect(() => {
    if (isSuperAdminSession()) return undefined;
    let active = true;
    getMyAccess()
      .then((access) => {
        if (active) {
          setVisibleModules(access.bypass ? null : new Set(access.visibleModules || []));
          setCreatableResources(
            access.bypass
              ? null
              : new Set(
                  (access.permissions || [])
                    .filter((permission) => permission.actions?.includes('create'))
                    .map((permission) => permission.resource),
                ),
          );
        }
      })
      .catch(() => {
        if (active) {
          setVisibleModules(new Set());
          setCreatableResources(new Set());
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type === 'mousedown' && menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const availableActions = useMemo(
    () =>
      actions.filter(
        (action) =>
          (visibleModules === null || visibleModules.has(action.moduleKey)) &&
          (creatableResources === null || creatableResources.has(action.resource)),
      ),
    [creatableResources, visibleModules],
  );

  if (availableActions.length === 0) return null;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="ui-primary-button inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold shadow-sm"
      >
        <Plus size={16} strokeWidth={2} />
        <span className="hidden md:inline">New</span>
        <ChevronDown size={14} className={`hidden transition md:block ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="ui-surface absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-xl border p-1.5 shadow-xl"
        >
          <p className="ui-muted px-3 py-2 text-[11px] font-bold uppercase tracking-wider">Quick add</p>
          {availableActions.map(({ label, to, icon: Icon }) => (
            <Link
              key={label}
              role="menuitem"
              to={to}
              onClick={() => setOpen(false)}
              className="app-sidebar-hover flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold"
            >
              <Icon size={17} strokeWidth={1.8} />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuickAddMenu;
