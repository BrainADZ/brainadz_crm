import { Check } from 'lucide-react';

const BusinessUnitSelector = ({ businessUnits, selectedIds, onChange, disabled = false }) => {
  const toggle = (id) =>
    onChange(
      selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id],
    );
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {businessUnits.map((unit) => {
        const active = selectedIds.includes(unit._id);
        return (
          <button
            key={unit._id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(unit._id)}
            className={`flex items-center justify-between rounded-xl border p-3 text-left text-sm font-semibold transition ${active ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200'} disabled:cursor-not-allowed disabled:opacity-70`}
          >
            <span>{unit.name}</span>
            <span
              className={`flex h-5 w-5 items-center justify-center rounded border ${active ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'}`}
            >
              {active && <Check size={13} />}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default BusinessUnitSelector;
