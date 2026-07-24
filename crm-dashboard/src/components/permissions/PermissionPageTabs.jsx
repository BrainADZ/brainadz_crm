const PermissionPageTabs = ({ tabs, activeTab, onChange }) => (
  <nav
    className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm"
    aria-label="Permission settings"
  >
    {tabs.map((tab) => {
      const Icon = tab.icon;
      return (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${activeTab === tab.key ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          <Icon size={16} />
          {tab.label}
        </button>
      );
    })}
  </nav>
);

export default PermissionPageTabs;
