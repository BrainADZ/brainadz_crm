import { Check, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

const MATRIX_ACTIONS = [
  ['view', 'View'],
  ['create', 'Create'],
  ['update', 'Edit'],
  ['delete', 'Delete'],
  ['assign', 'Assign'],
  ['import', 'Import'],
  ['export', 'Export'],
  ['manage', 'Manage'],
];

const RESOURCE_LABELS = {
  leads: 'Sales Data',
  campaigns: 'Marketing Records',
  accounting: 'Accounts Records',
  projects: 'Projects',
  tasks: 'Tasks',
  employees: 'Employee Directory',
  permissions: 'Permission Settings',
  roles: 'Roles',
  audit_logs: 'Recent Activity',
};
const title = (value) =>
  RESOURCE_LABELS[value] ||
  value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const ModulePermissionMatrix = ({ modules, permissions, onChange, locked = false }) => {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const permissionMap = useMemo(
    () => new Map(permissions.map((permission) => [permission.resource, permission])),
    [permissions],
  );
  const filtered = modules.filter(
    (module) =>
      module.label.toLowerCase().includes(search.toLowerCase()) ||
      module.resources.some((resource) =>
        title(resource).toLowerCase().includes(search.toLowerCase()),
      ),
  );
  const hasAction = (resource, action) => permissionMap.get(resource)?.actions?.includes(action);
  const moduleActionState = (module, action) => {
    const count = module.resources.filter((resource) => hasAction(resource, action)).length;
    return count === module.resources.length ? 'all' : count ? 'some' : 'none';
  };
  const setResourcesAction = (resources, action, enabled) => {
    const next = new Map(
      permissions.map((permission) => [
        permission.resource,
        { ...permission, actions: [...permission.actions] },
      ]),
    );
    resources.forEach((resource) => {
      const permission = next.get(resource) || { resource, actions: [], scope: 'ASSIGNED' };
      permission.actions = enabled
        ? [...new Set([...permission.actions, action])]
        : permission.actions.filter((item) => item !== action);
      if (permission.actions.length) next.set(resource, permission);
      else next.delete(resource);
    });
    onChange([...next.values()]);
  };
  const setAll = (enabled) => {
    if (!enabled) return onChange([]);
    onChange(
      modules
        .flatMap((module) => module.resources)
        .map((resource) => ({
          resource,
          actions: MATRIX_ACTIONS.map(([action]) => action),
          scope: 'ASSIGNED',
        })),
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search module or submodule"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 sm:w-72"
          />
        </label>
        {!locked && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAll(true)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => setAll(false)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
            >
              Clear all
            </button>
          </div>
        )}
      </div>
      <div className="max-h-[38rem] overflow-auto rounded-xl border border-slate-200">
        <div className="sticky top-0 z-20 grid min-w-[64rem] grid-cols-[minmax(14rem,1fr)_repeat(8,5rem)] bg-slate-100 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Module</span>
          {MATRIX_ACTIONS.map(([action, label]) => (
            <span key={action} className="text-center">
              {label}
            </span>
          ))}
        </div>
        {filtered.map((module) => (
          <div
            key={module.moduleKey || module.key}
            className="min-w-[64rem] border-t border-slate-200"
          >
            <div className="grid grid-cols-[minmax(14rem,1fr)_repeat(8,5rem)] items-center px-3 py-3">
              <button
                type="button"
                onClick={() =>
                  setExpanded((current) => ({
                    ...current,
                    [module.moduleKey || module.key]: !current[module.moduleKey || module.key],
                  }))
                }
                className="flex items-center gap-2 text-left text-sm font-semibold text-slate-900"
              >
                {expanded[module.moduleKey || module.key] ? (
                  <ChevronDown size={15} />
                ) : (
                  <ChevronRight size={15} />
                )}
                {module.label}
              </button>
              {MATRIX_ACTIONS.map(([action]) => {
                const state = locked ? 'all' : moduleActionState(module, action);
                return (
                  <span key={action} className="text-center">
                    <button
                      type="button"
                      disabled={locked}
                      aria-label={`${module.label} ${action}`}
                      onClick={() => setResourcesAction(module.resources, action, state !== 'all')}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border ${state === 'all' ? 'border-blue-600 bg-blue-600 text-white' : state === 'some' ? 'border-blue-400 bg-blue-100 text-blue-700' : 'border-slate-300 text-transparent'} disabled:cursor-default`}
                    >
                      <Check size={14} />
                    </button>
                  </span>
                );
              })}
            </div>
            {expanded[module.moduleKey || module.key] && (
              <div className="bg-slate-50/70">
                {module.resources.map((resource) => (
                  <div
                    key={resource}
                    className="grid grid-cols-[minmax(14rem,1fr)_repeat(8,5rem)] items-center border-t border-slate-100 px-3 py-2"
                  >
                    <span className="pl-6 text-xs font-medium text-slate-600">
                      {title(resource)}
                    </span>
                    {MATRIX_ACTIONS.map(([action]) => {
                      const active = locked || hasAction(resource, action);
                      return (
                        <span key={action} className="text-center">
                          <button
                            type="button"
                            disabled={locked}
                            onClick={() => setResourcesAction([resource], action, !active)}
                            className={`inline-flex h-6 w-6 items-center justify-center rounded border ${active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-transparent'}`}
                          >
                            <Check size={12} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ModulePermissionMatrix;
