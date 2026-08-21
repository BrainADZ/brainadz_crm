import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  createBusinessResource,
  deleteBusinessResource,
  listBusinessResource,
} from '../services/businessApi';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const labelClass = 'mb-1.5 block text-xs font-bold text-slate-600';
const iconButtonClass =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100 hover:text-blue-700';

const getInitialForm = (fields) =>
  fields.reduce(
    (accumulator, field) => ({
      ...accumulator,
      [field.name]: field.defaultValue ?? '',
    }),
    {},
  );

const Field = ({ field, value, onChange }) => {
  if (field.type === 'select') {
    return (
      <label className={field.full ? 'block sm:col-span-2' : 'block'}>
        <span className={labelClass}>{field.label}</span>
        <select
          className={inputClass}
          value={value}
          onChange={(event) => onChange(field.name, event.target.value)}
          required={field.required}
        >
          {(field.options || []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === 'textarea') {
    return (
      <label className="block sm:col-span-2">
        <span className={labelClass}>{field.label}</span>
        <textarea
          className={`${inputClass} min-h-24 resize-y`}
          value={value}
          onChange={(event) => onChange(field.name, event.target.value)}
          required={field.required}
          placeholder={field.placeholder}
        />
      </label>
    );
  }

  return (
    <label className={field.full ? 'block sm:col-span-2' : 'block'}>
      <span className={labelClass}>{field.label}</span>
      <input
        className={inputClass}
        type={field.type || 'text'}
        value={value}
        onChange={(event) =>
          onChange(
            field.name,
            field.type === 'number' ? Number(event.target.value) : event.target.value,
          )
        }
        required={field.required}
        placeholder={field.placeholder}
      />
    </label>
  );
};

const Stat = ({ label, value, note }) => (
  <div className="rounded-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
    {note && <p className="mt-1 text-xs font-semibold text-slate-500">{note}</p>}
  </div>
);

const Modal = ({ title, children, onClose }) => (
  <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
    <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">New record</p>
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        </div>
        <button type="button" onClick={onClose} className={iconButtonClass} aria-label="Close form">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 fill-none stroke-current"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      {children}
    </section>
  </div>
);

const BusinessResourcePage = ({
  resource,
  title,
  eyebrow,
  description,
  icon: Icon,
  fields,
  columns,
  stats,
  emptyText,
  createLabel = 'Create record',
}) => {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(() => getInitialForm(fields));
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setItems(await listBusinessResource(resource));
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Unable to load ${title}`);
    } finally {
      setIsLoading(false);
    }
  }, [resource, title]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filteredItems = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) return items;
    return items.filter((item) => JSON.stringify(item).toLowerCase().includes(search));
  }, [items, searchTerm]);

  const statRows = useMemo(() => stats(items), [items, stats]);

  const updateField = (name, value) => {
    setForm((previous) => ({ ...previous, [name]: value }));
    setMessage('');
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await createBusinessResource(resource, form);
      setItems((previous) => [response.item, ...previous]);
      setForm(getInitialForm(fields));
      setIsFormOpen(false);
      setMessage(response.message || 'Record created successfully');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create record');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const label = item.name || item.code || item.clientName || item.client || 'record';
    if (!window.confirm(`Delete ${label}?`)) return;

    setMessage('');
    setError('');
    try {
      const response = await deleteBusinessResource(resource, item._id);
      setItems((previous) => previous.filter((current) => current._id !== item._id));
      setMessage(response.message || 'Record deleted successfully');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete record');
    }
  };

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
            <Icon size={20} strokeWidth={1.9} />
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-500">{eyebrow}</p>
            <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">{description}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
          >
            <Plus size={16} strokeWidth={1.9} />
            {createLabel}
          </button>
          <button
            type="button"
            onClick={loadItems}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
          >
            <RefreshCw size={16} strokeWidth={1.9} />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statRows.map((stat) => (
          <Stat key={stat.label} {...stat} />
        ))}
      </section>

      {(message || error) && (
        <p
          className={`rounded-lg border px-4 py-3 text-sm font-bold ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
        >
          {error || message}
        </p>
      )}

      <section className="overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-300 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-950">{title} Records</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {filteredItems.length} visible records
            </p>
          </div>
          <input
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-72"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search records..."
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[62rem] w-full table-fixed border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`${column.width || 'w-40'} border-b border-r border-slate-300 px-4 py-2 font-bold last:border-r-0`}
                  >
                    {column.label}
                  </th>
                ))}
                <th className="w-20 border-b border-slate-300 px-4 py-2 text-right font-bold">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item._id} className="bg-white transition hover:bg-blue-50/40">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className="border-b border-r border-slate-200 px-4 py-3 last:border-r-0"
                    >
                      {column.render ? column.render(item) : String(item[column.key] ?? '-')}
                    </td>
                  ))}
                  <td className="border-b border-slate-200 px-4 py-3 text-right">
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => handleDelete(item)}
                      className={iconButtonClass}
                    >
                      <Trash2 size={15} strokeWidth={1.9} />
                    </button>
                  </td>
                </tr>
              ))}
              {!isLoading && filteredItems.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="px-4 py-16 text-center text-sm font-semibold text-slate-500"
                  >
                    {emptyText}
                  </td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="px-4 py-16 text-center text-sm font-semibold text-slate-500"
                  >
                    Loading records...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isFormOpen && (
        <Modal title={createLabel} onClose={() => setIsFormOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <Field
                  key={field.name}
                  field={field}
                  value={form[field.name]}
                  onChange={updateField}
                />
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:bg-slate-300"
              >
                {isSaving ? 'Saving...' : createLabel}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default BusinessResourcePage;