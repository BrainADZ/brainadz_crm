const palette = ['#165DFF', '#EF4444', '#14B8A6', '#F59E0B', '#7C3AED', '#94A3B8'];

export const Panel = ({ title, subtitle, action, children, className = '' }) => (
  <article className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
      <div>
        <h2 className="text-sm font-bold text-slate-950">{title}</h2>
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
    <div className="flex flex-col items-center justify-center p-5">
      <div className="relative h-24 w-48 overflow-hidden">
        <div className="absolute left-0 top-0 h-48 w-48 rounded-full bg-slate-100" />
        <div
          className="absolute left-0 top-0 h-48 w-48 rounded-full"
          style={{
            background: `conic-gradient(from 270deg, #165DFF 0deg ${safeValue * 1.8}deg, transparent ${safeValue * 1.8}deg 180deg, transparent 180deg)`,
          }}
        />
        <div className="absolute left-5 top-5 h-40 w-40 rounded-full bg-white" />
      </div>
      <p className="-mt-4 text-3xl font-bold text-slate-950">{safeValue}%</p>
      <p className="mt-1 text-xs font-medium text-slate-500">Lead-to-win conversion</p>
    </div>
  );
};
