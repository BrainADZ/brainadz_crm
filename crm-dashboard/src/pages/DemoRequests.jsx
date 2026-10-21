import { useEffect, useState } from 'react';
import { MessageSquareText, RefreshCw, Search, X } from 'lucide-react';
import { assignDemoRequest, getDemoRequestCapabilities, getDemoRequestOptions, getDemoRequests, updateDemoRequest } from '../services/demoRequestApi';

const STATUSES = ['New', 'Contacted', 'Qualified', 'Closed'];
const field =
  'h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const date = (value) => (value ? new Date(value).toLocaleString('en-IN') : '—');
const rowStyle = {
  New: 'bg-amber-50/60',
  Contacted: 'bg-sky-50/60',
  Qualified: 'bg-cyan-50/70',
  Closed: 'bg-green-50/70',
};
const statusStyle = {
  New: 'bg-amber-100 text-amber-800',
  Contacted: 'bg-sky-100 text-sky-800',
  Qualified: 'bg-cyan-100 text-cyan-800',
  Closed: 'bg-green-100 text-green-800',
};
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
  const [canAssign, setCanAssign] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [assigneeId, setAssigneeId] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    getDemoRequestCapabilities().then(async (access) => {
      if (!access.canAssign) return;
      setCanAssign(true);
      setEmployees(await getDemoRequestOptions());
    }).catch(() => setCanAssign(false));
  }, []);

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
    setAssigneeId(request.assignedTo?._id || '');
    setSaveError('');
  };

  const saveAssignment = async () => {
    setAssigning(true);
    setSaveError('');
    try {
      await assignDemoRequest(selected._id, assigneeId);
      setSelected(null);
      setRefresh((value) => value + 1);
    } catch (requestError) {
      setSaveError(requestError.response?.data?.message || 'Unable to change assignment.');
    } finally {
      setAssigning(false);
    }
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
    <div className="w-full space-y-5">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
        >
          {error}
        </p>
      )}
      <section
        className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm"
        aria-busy={loading}
      >
        <div className="border-b border-slate-300 bg-slate-100 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-sm font-semibold text-slate-800">Demo request table</h1>
              <p className="mt-1 text-xs text-slate-500">
                New enquiries are shared with the Live team. The first status update claims the request.
              </p>
            </div>
            <button
              type="button"
              className={`${field} inline-flex items-center gap-2`}
              disabled={loading}
              onClick={() => setRefresh((value) => value + 1)}
            >
              <RefreshCw
                size={14}
                className={loading ? 'animate-spin' : ''}
              />
              Refresh
            </button>
          </div>
          <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <label className="relative w-full xl:max-w-sm">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  aria-label="Search demo requests"
                  placeholder="Search name, phone, email, company..."
                  className={`${field} w-full pl-9 font-normal`}
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
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
                  aria-label="Filter product"
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
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-500">
                {loading
                  ? 'Loading requests...'
                  : `${data.items.length} visible requests / ${data.total} matching requests`}
              </span>
              <div className="flex flex-wrap gap-2">
                {['', ...STATUSES].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setStatus(value);
                      setPage(1);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold ${status === value ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-blue-50'}`}
                  >
                    {value || 'All'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="compact-crm-table min-w-[100rem] w-full table-fixed border-collapse text-left">
            <colgroup>
              {[55, 120, 140, 155, 120, 190, 90, 120, 220, 140, 105, 105, 140, 70].map(
                (width, index) => (
                  <col
                    key={index}
                    style={{ width }}
                  />
                ),
              )}
            </colgroup>
            <thead>
              <tr className="bg-slate-100">
                {[
                  'S.No.',
                  'Request ID',
                  'Full Name',
                  'Company / Brand',
                  'Phone',
                  'Work Email',
                  'Product',
                  'Company Size',
                  'Requirements',
                  'Received',
                  'Email Delivery',
                  'Status',
                  'Assigned To',
                  'Actions',
                ].map((label) => (
                  <th
                    key={label}
                    className={`border border-slate-300 px-3 py-2 font-semibold leading-4 text-slate-800 ${label === 'S.No.' || label === 'Actions' ? 'text-center' : ''}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((request, index) => (
                <tr
                  key={request._id}
                  className={rowStyle[request.status] || 'bg-white'}
                >
                  <td className="border border-slate-300 px-3 py-2 text-center text-slate-700">
                    {(page - 1) * 25 + index + 1}
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    <button
                      type="button"
                      title={request.requestId}
                      onClick={() => openRequest(request)}
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      DEMO-{request.requestId.slice(0, 8).toUpperCase()}
                    </button>
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-slate-700">
                    <div className="two-line-cell">{request.name}</div>
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-slate-700">
                    <div className="two-line-cell">{request.companyName}</div>
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    <a
                      href={`tel:${request.phone}`}
                      className="text-slate-700 hover:text-blue-700"
                    >
                      {request.phone}
                    </a>
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    <a
                      href={`mailto:${request.email}`}
                      className="two-line-cell text-blue-700 hover:underline"
                    >
                      {request.email}
                    </a>
                  </td>
                  <td className="border border-slate-300 px-3 py-2 uppercase text-slate-700">
                    {request.demoType}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-slate-700">
                    {request.companySize}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-slate-700">
                    <p
                      className="line-clamp-2"
                      title={request.requirements}
                    >
                      {request.requirements}
                    </p>
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-slate-700">
                    {date(request.createdAt)}
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    <span
                      className={`rounded-full px-2.5 py-1 font-semibold capitalize ${deliveryStyle[request.deliveryStatus]}`}
                    >
                      {request.deliveryStatus}
                    </span>
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    <span
                      className={`rounded-full px-2.5 py-1 font-semibold ${statusStyle[request.status]}`}
                    >
                      {request.status}
                    </span>
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-slate-700">
                    {request.assignedTo?.name || request.assignedTo?.email || 'Unassigned'}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-center">
                    <button
                      type="button"
                      title="View details and update status"
                      aria-label={`View request from ${request.name}`}
                      onClick={() => openRequest(request)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-sm hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <MessageSquareText size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {!data.items.length && (
                <tr>
                  <td
                    colSpan={14}
                    className="border border-slate-300 p-10 text-center text-slate-500"
                  >
                    {loading ? 'Loading requests...' : 'No demo requests match these filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <span>{data.total} matching requests</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={`${field} disabled:opacity-40`}
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
              className={`${field} disabled:opacity-40`}
              disabled={page >= data.pages || loading}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </div>
        </footer>
      </section>
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
                'Request ID': selected.requestId,
                Email: selected.email,
                Phone: selected.phone,
                'Company size': selected.companySize,
                Received: date(selected.createdAt),
                'Email delivery': selected.deliveryStatus,
                'Emailed at': date(selected.emailedAt),
                'Access type': selected.accessType,
                'Delivery note': selected.deliveryError || '—',
                'Assigned to': selected.assignedTo?.name || selected.assignedTo?.email || 'Unassigned',
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
            {canAssign && (
              <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <label className="block text-sm font-semibold" htmlFor="demo-assignee">Assign / reassign</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <select id="demo-assignee" className={field} value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
                    <option value="">Unassigned (shared Live queue)</option>
                    {employees.map((employee) => <option key={employee._id} value={employee._id}>{employee.name || employee.email}</option>)}
                  </select>
                  <button type="button" disabled={assigning} onClick={saveAssignment} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">
                    {assigning ? 'Saving...' : assigneeId ? 'Assign' : 'Unassign'}
                  </button>
                </div>
              </div>
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
                  className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-blue-500"
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
