import { useEffect, useState } from 'react';
import { Inbox, RefreshCw, Search, X } from 'lucide-react';
import { getDemoRequests, updateDemoRequest } from '../services/demoRequestApi';

const STATUSES = ['New', 'Contacted', 'Qualified', 'Closed'];
const field =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#193175]';
const date = (value) => (value ? new Date(value).toLocaleString('en-IN') : '—');
const deliveryStyle = {
  sent: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  failed: 'bg-rose-100 text-rose-800',
};

export default function DemoRequests() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [demoType, setDemoType] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState({ items: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [editStatus, setEditStatus] = useState('New');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      getDemoRequests({ search, status, demoType, deliveryStatus, page }, controller.signal)
        .then(setData)
        .catch((requestError) => {
          if (!controller.signal.aborted)
            setError(requestError.response?.data?.message || 'Unable to load demo requests.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, status, demoType, deliveryStatus, page, refresh]);

  useEffect(() => {
    const timer = setInterval(() => setRefresh((value) => value + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selected) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape' && !saving) setSelected(null);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [selected, saving]);

  const openRequest = (request) => {
    setSelected(request);
    setEditStatus(request.status);
    setNotes(request.notes || '');
    setSaveError('');
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      await updateDemoRequest(selected._id, { status: editStatus, notes });
      setSelected(null);
      setRefresh((value) => value + 1);
    } catch (requestError) {
      setSaveError(requestError.response?.data?.message || 'Unable to save this request.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
            <Inbox />
            Demo Requests
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Website demo requests for the Live team · {data.total} matching requests
          </p>
        </div>
        <button
          type="button"
          className={`${field} flex items-center gap-2`}
          onClick={() => setRefresh((value) => value + 1)}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>
      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="flex items-center gap-2">
          <Search size={18} />
          <input
            aria-label="Search demo requests"
            placeholder="Name, company, email or phone"
            className={`${field} w-64`}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          aria-label="Filter status"
          className={field}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {STATUSES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          aria-label="Filter demo type"
          className={field}
          value={demoType}
          onChange={(event) => {
            setDemoType(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All products</option>
          {['erp', 'crm', 'pos', 'hospitality', 'software'].map((value) => (
            <option
              key={value}
              value={value}
            >
              {value.toUpperCase()}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter email delivery"
          className={field}
          value={deliveryStatus}
          onChange={(event) => {
            setDeliveryStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All email delivery</option>
          {['pending', 'sent', 'failed'].map((value) => (
            <option
              key={value}
              value={value}
            >
              {value}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 p-4 text-rose-700"
        >
          {error}
        </p>
      )}
      <div
        className="overflow-x-auto rounded-xl border border-slate-200 bg-white"
        aria-busy={loading}
      >
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {[
                'Contact',
                'Company',
                'Product',
                'Received',
                'Email delivery',
                'Status',
                'Details',
              ].map((label) => (
                <th
                  key={label}
                  className="whitespace-nowrap px-4 py-3"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.items.map((request) => (
              <tr
                key={request._id}
                className="hover:bg-slate-50"
              >
                <td className="px-4 py-4">
                  <p className="font-semibold text-slate-900">{request.name}</p>
                  <a
                    className="block text-[#193175]"
                    href={`mailto:${request.email}`}
                  >
                    {request.email}
                  </a>
                  <span className="text-slate-500">{request.phone}</span>
                </td>
                <td className="px-4 py-4">
                  <p>{request.companyName}</p>
                  <p className="text-xs text-slate-500">{request.companySize}</p>
                </td>
                <td className="px-4 py-4 uppercase">{request.demoType}</td>
                <td className="whitespace-nowrap px-4 py-4 text-xs">{date(request.createdAt)}</td>
                <td className="px-4 py-4">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${deliveryStyle[request.deliveryStatus]}`}
                  >
                    {request.deliveryStatus}
                  </span>
                </td>
                <td className="px-4 py-4">{request.status}</td>
                <td className="px-4 py-4">
                  <button
                    type="button"
                    className="font-semibold text-[#193175] underline underline-offset-4"
                    onClick={() => openRequest(request)}
                  >
                    View / update
                  </button>
                </td>
              </tr>
            ))}
            {!data.items.length && (
              <tr>
                <td
                  colSpan={7}
                  className="p-10 text-center text-slate-500"
                >
                  {loading ? 'Loading requests…' : 'No demo requests match these filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-4 text-sm">
        <button
          type="button"
          className={field}
          disabled={page <= 1 || loading}
          onClick={() => setPage((value) => value - 1)}
        >
          Previous
        </button>
        <span>
          Page {page} of {data.pages}
        </span>
        <button
          type="button"
          className={field}
          disabled={page >= data.pages || loading}
          onClick={() => setPage((value) => value + 1)}
        >
          Next
        </button>
      </div>
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-request-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="demo-request-title"
                  className="text-xl font-bold"
                >
                  {selected.companyName}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selected.name} · {selected.demoType.toUpperCase()} demo
                </p>
              </div>
              <button
                autoFocus
                type="button"
                aria-label="Close details"
                disabled={saving}
                onClick={() => setSelected(null)}
              >
                <X />
              </button>
            </div>
            <dl className="my-5 grid gap-3 text-sm sm:grid-cols-2">
              {Object.entries({
                Email: selected.email,
                Phone: selected.phone,
                'Company size': selected.companySize,
                Received: date(selected.createdAt),
                'Email delivery': selected.deliveryStatus,
                'Emailed at': date(selected.emailedAt),
                'Access type': selected.accessType,
                'Delivery note': selected.deliveryError || '—',
              }).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
                  <dd className="mt-1 break-words">{value}</dd>
                </div>
              ))}
            </dl>
            <h3 className="text-sm font-semibold">Requirements</h3>
            <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">
              {selected.requirements}
            </p>
            <p className="mt-4 break-all text-xs text-slate-500">
              Source: {selected.pageUrl || 'Not recorded'}
            </p>
            {selected.campaign?.utm_campaign && (
              <p className="mt-1 text-xs text-slate-500">
                Campaign: {selected.campaign.utm_campaign} · {selected.campaign.utm_source} /{' '}
                {selected.campaign.utm_medium}
              </p>
            )}
            <form
              onSubmit={save}
              className="mt-6 space-y-4"
            >
              <label className="block text-sm font-semibold">
                Status
                <select
                  className={`${field} mt-2 block w-full`}
                  value={editStatus}
                  onChange={(event) => setEditStatus(event.target.value)}
                >
                  {STATUSES.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Team notes
                <textarea
                  className={`${field} mt-2 block w-full font-normal`}
                  rows={4}
                  maxLength={4000}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
              {saveError && (
                <p
                  role="alert"
                  className="text-sm text-rose-700"
                >
                  {saveError}
                </p>
              )}
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#193175] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
