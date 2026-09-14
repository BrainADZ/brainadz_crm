const palette = ['#165DFF', '#EF4444', '#14B8A6', '#F59E0B', '#7C3AED', '#94A3B8'];

export const Panel = ({ title, subtitle, action, children, className = '' }) => (
  <article className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] ${className}`}>
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
      <div>
        <h2 className="text-sm font-bold tracking-tight text-slate-950">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </article>
);

export const DonutChart = ({ items, centerLabel = 'Total', centerValue }) => {
  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
  let progress = 0;
  const segments = items.map((item, index) => {
    const start = total ? (progress / total) * 100 : 0;
    progress += Number(item.value || 0);
    const end = total ? (progress / total) * 100 : 0;
    return `${item.color || palette[index % palette.length]} ${start}% ${end}%`;
  });

  return (
    <div className="grid items-center gap-6 p-5 sm:grid-cols-[10rem_1fr]">
      <div
        className="relative mx-auto h-36 w-36 rounded-full"
        style={{ background: total ? `conic-gradient(${segments.join(',')})` : '#E2E8F0' }}
      >
        <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
          <span className="text-2xl font-bold text-slate-950">{centerValue ?? total}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {centerLabel}
          </span>
        </div>
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-slate-600">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color || palette[index % palette.length] }}
              />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="font-bold text-slate-900">{item.value || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const BarChart = ({ items, valueSuffix = '' }) => {
  const max = Math.max(1, ...items.map((item) => Number(item.value || 0)));
  return (
    <div className="space-y-4 p-5">
      {items.map((item, index) => (
        <div key={item.label}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
            <span className="truncate font-medium text-slate-600">{item.label}</span>
            <span className="font-bold text-slate-900">{item.value || 0}{valueSuffix}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(Number(item.value || 0) ? 5 : 0, (Number(item.value || 0) / max) * 100)}%`,
                backgroundColor: item.color || palette[index % palette.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export const ConversionGauge = ({ value = 0 }) => {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className="flex min-h-52 flex-col items-center justify-center px-5 py-4">
      <div className="relative h-28 w-52">
        <svg viewBox="0 0 200 112" className="h-full w-full overflow-visible" aria-hidden="true">
          <path
            d="M 18 100 A 82 82 0 0 1 182 100"
            fill="none"
            stroke="#E8EEF7"
            strokeWidth="18"
            strokeLinecap="round"
            pathLength="100"
          />
          <path
            d="M 18 100 A 82 82 0 0 1 182 100"
            fill="none"
            stroke="url(#conversion-gradient)"
            strokeWidth="18"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray={`${safeValue} 100`}
          />
          <defs>
            <linearGradient id="conversion-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#165DFF" />
              <stop offset="100%" stopColor="#EF4444" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <p className="text-3xl font-bold leading-none text-slate-950">{safeValue}%</p>
        </div>
      </div>
      <p className="mt-3 text-xs font-medium text-slate-500">Lead-to-win conversion</p>
    </div>
  );
};
