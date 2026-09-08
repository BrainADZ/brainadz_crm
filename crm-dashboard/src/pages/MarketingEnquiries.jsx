import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, MessageSquareText, Search, X } from 'lucide-react';
import {
  assignWebsiteEnquiries,
  getWebsiteEnquiries,
  getWebsiteEnquiryOptions,
  updateWebsiteEnquiryAction,
} from '../services/websiteEnquiryApi';

const STATUSES = [
  'Pending',
  'Contacted',
  'Follow Up',
  'Interested',
  'Not Interested',
  'Converted',
  'Not Reachable',
];
const rowStyle = {
  Pending: 'bg-amber-50/60',
  Contacted: 'bg-sky-50/60',
  'Follow Up': 'bg-violet-50/70',
  Interested: 'bg-cyan-50/70',
  'Not Interested': 'bg-rose-50/60',
  Converted: 'bg-green-100/70',
  'Not Reachable': 'bg-orange-50/60',
};
const selectStyle = {
  Pending: 'border-amber-300 bg-amber-100 text-amber-800',
  Contacted: 'border-sky-300 bg-sky-100 text-sky-800',
  'Follow Up': 'border-violet-300 bg-violet-100 text-violet-800',
  Interested: 'border-cyan-300 bg-cyan-100 text-cyan-800',
  'Not Interested': 'border-rose-300 bg-rose-100 text-rose-800',
  Converted: 'border-green-400 bg-green-100 text-green-900',
  'Not Reachable': 'border-orange-300 bg-orange-100 text-orange-800',
};
const field =
  'h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none';

export default function MarketingEnquiries() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [employee, setEmployee] = useState('all');
  const [assignment, setAssignment] = useState('all');
  const [selected, setSelected] = useState([]);
  const [distribution, setDistribution] = useState('full');
  const [assignTo, setAssignTo] = useState('');
  const [action, setAction] = useState(null);
  const [actionStatus, setActionStatus] = useState('Pending');
  const [remark, setRemark] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [saved, setSaved] = useState(false);
  const [data, setData] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadEnquiries = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await getWebsiteEnquiries({ communityKey: 'marketing', limit: 200 });
      setData(
        (result.items || []).map((item) => ({
          ...item,
          id: item.enquiryNumber,
          assignee: item.assignedTo?.name || 'Unassigned',
          received: new Date(item.createdAt).toLocaleDateString('en-IN'),
        })),
      );
      setCounts({ all: result.total, ...result.statusCounts });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load marketing enquiries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEnquiries();
    getWebsiteEnquiryOptions('marketing')
      .then((result) => setEmployees(result.employees || []))
      .catch((requestError) => {
        setError(requestError.response?.data?.message || 'Unable to load employee options');
      });
  }, [loadEnquiries]);
  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter(
      (r) =>
        (!q || Object.values(r).some((v) => String(v).toLowerCase().includes(q))) &&
        (status === 'all' || r.status === status) &&
        (employee === 'all' || String(r.assignedTo?._id || '') === employee) &&
        (assignment === 'all' ||
          (assignment === 'assigned' ? Boolean(r.assignedTo) : !r.assignedTo)),
    );
  }, [data, search, status, employee, assignment]);
  const openAction = (r) => {
    setAction(r);
    setActionStatus(r.status);
    setRemark(r.remark || '');
    setFollowUp(r.followUpDate?.slice(0, 10) || '');
    setSaved(false);
  };
  const assign = async (clear = false) => {
    try {
      await assignWebsiteEnquiries({
        ids: selected,
        employeeId: clear ? '' : assignTo,
        communityKey: 'marketing',
      });
      setSelected([]);
      await loadEnquiries();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update assignment');
    }
  };
  const saveAction = async () => {
    try {
      const item = await updateWebsiteEnquiryAction(action._id, {
        communityKey: 'marketing',
        status: actionStatus,
        remark,
        followUpDate: followUp,
      });
      setData((current) =>
        current.map((row) =>
          row._id === item._id
            ? {
                ...item,
                id: item.enquiryNumber,
                assignee: item.assignedTo?.name || 'Unassigned',
                received: new Date(item.createdAt).toLocaleDateString('en-IN'),
              }
            : row,
        ),
      );
      setSaved(true);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save action');
    }
  };
  return (
    <div className="w-full space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}
      <section className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
        <div className="border-b border-slate-300 bg-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Marketing enquiry table</h2>
          <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <label className="relative w-full xl:max-w-sm">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, phone, email, company..."
                  className="h-9 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <div className="grid flex-1 grid-cols-2 gap-2 md:grid-cols-3">
                <Filter value={status} set={setStatus} label="All statuses" items={STATUSES} />
                <select
                  value={employee}
                  onChange={(e) => setEmployee(e.target.value)}
                  className={field}
                >
                  <option value="all">All employees</option>
                  {employees.map((x) => (
                    <option key={x._id} value={x._id}>
                      {x.name || x.email}
                    </option>
                  ))}
                </select>
                <select
                  value={assignment}
                  onChange={(e) => setAssignment(e.target.value)}
                  className={field}
                >
                  <option value="all">All assignments</option>
                  <option value="assigned">Assigned</option>
                  <option value="unassigned">Unassigned</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500">
                {loading ? 'Loading enquiries...' : `${rows.length} visible enquiries`}
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  ['all', 'All'],
                  ['Pending', 'Pending'],
                  ['Contacted', 'Contacted'],
                  ['Follow Up', 'Follow-up'],
                  ['Interested', 'Interested'],
                  ['Converted', 'Converted'],
                ].map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => setStatus(v)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold ${status === v ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-blue-50'}`}
                  >
                    {l} <span className="ml-1 opacity-80">{counts[v]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid gap-3 lg:grid-cols-[auto_minmax(10rem,0.7fr)_minmax(16rem,1.2fr)_auto] lg:items-end">
              <div>
                <Label>Row selection</Label>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setSelected(
                        rows.filter((row) => row.assignee === 'Unassigned').map((row) => row._id),
                      )
                    }
                    className="h-10 rounded-lg border border-slate-300 px-3 text-xs font-semibold hover:bg-blue-50"
                  >
                    Select free rows
                  </button>
                  <button
                    onClick={() => setSelected([])}
                    disabled={!selected.length}
                    className="h-10 rounded-lg border border-slate-300 px-3 text-xs font-semibold disabled:opacity-40"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <label>
                <Label>Distribution</Label>
                <select
                  value={distribution}
                  onChange={(e) => setDistribution(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="full">Full data ({rows.length})</option>
                  <option value="half">Half data ({Math.ceil(rows.length / 2)})</option>
                  <option value="limited">Limited records</option>
                  <option value="selected">Selected rows ({selected.length})</option>
                </select>
              </label>
              <label>
                <Label>Assign employees</Label>
                <select
                  value={assignTo}
                  onChange={(e) => setAssignTo(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="">Select employees</option>
                  {employees.map((x) => (
                    <option key={x._id} value={x._id}>
                      {x.name || x.email}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => assign(false)}
                  disabled={!assignTo || !selected.length}
                  className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:bg-slate-300"
                >
                  Assign
                </button>
                <button
                  onClick={() => assign(true)}
                  disabled={!selected.length}
                  className="h-10 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-600 disabled:opacity-40"
                >
                  Unassign
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="min-w-[100rem] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-100">
                <TH center>Select</TH>
                {[
                  'S.No.',
                  'Enquiry ID',
                  'Full Name',
                  'Company / Brand',
                  'Phone',
                  'Work Email',
                  'Main Service',
                  'Service Required',
                  'Received',
                  'Priority',
                  'Assigned To',
                  'Meeting',
                  'Actions',
                ].map((x) => (
                  <TH key={x} center={x === 'S.No.' || x === 'Meeting' || x === 'Actions'}>
                    {x}
                  </TH>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={rowStyle[r.status] || 'bg-white'}>
                  <TD center>
                    <input
                      type="checkbox"
                      checked={selected.includes(r._id)}
                      onChange={() =>
                        setSelected((c) =>
                          c.includes(r._id) ? c.filter((id) => id !== r._id) : [...c, r._id],
                        )
                      }
                    />
                  </TD>
                  <TD center>{i + 1}</TD>
                  <TD>{r.id}</TD>
                  <TD>{r.name}</TD>
                  <TD>{r.company}</TD>
                  <TD>+91 {r.phone}</TD>
                  <TD>{r.email}</TD>
                  <TD>{r.category}</TD>
                  <TD>{r.service}</TD>
                  <TD>{r.received}</TD>
                  <TD>{r.priority}</TD>
                  <TD>
                    {r.assignee === 'Unassigned' ? (
                      <span className="text-slate-400">Unassigned</span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        {r.assignee}
                      </span>
                    )}
                  </TD>
                  <TD center>
                    {r.status === 'Interested' ? (
                      <button className="inline-flex items-center gap-1 rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-800">
                        <CalendarDays size={14} />
                        Schedule meeting
                      </button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TD>
                  <TD center>
                    <button
                      onClick={() => openAction(r)}
                      title="Open actions"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-sm hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <MessageSquareText size={16} />
                    </button>
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  Client actions
                </p>
                <h3 className="text-lg font-semibold text-slate-950">Status, remark & log</h3>
              </div>
              <button
                onClick={() => setAction(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            {saved ? (
              <div className="flex min-h-72 flex-col items-center justify-center p-10 text-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Check size={40} />
                </span>
                <h3 className="mt-5 text-xl font-bold">Your action saved successfully</h3>
                <p className="mt-2 text-sm text-slate-500">Status and remark have been updated.</p>
              </div>
            ) : (
              <div className="max-h-[calc(90vh-74px)] overflow-y-auto p-5">
                <div className="space-y-5">
                  <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <label>
                      <Label>Status</Label>
                      <select
                        value={actionStatus}
                        onChange={(e) => {
                          setActionStatus(e.target.value);
                          if (e.target.value !== 'Follow Up') setFollowUp('');
                        }}
                        className={`h-10 w-full rounded-lg border px-3 text-sm font-bold outline-none ${selectStyle[actionStatus] || 'border-slate-300 bg-white'}`}
                      >
                        {STATUSES.map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                    {actionStatus === 'Follow Up' && (
                      <label className="mt-4 block">
                        <Label>Follow-up date</Label>
                        <input
                          type="date"
                          value={followUp}
                          onChange={(e) => setFollowUp(e.target.value)}
                          className="h-10 w-full rounded-lg border border-violet-300 bg-violet-50 px-3 text-sm font-semibold text-violet-800"
                        />
                      </label>
                    )}
                    <label className="mt-4 block">
                      <Label>Remark</Label>
                      <textarea
                        rows="4"
                        value={remark}
                        onChange={(e) => setRemark(e.target.value)}
                        placeholder="Write remark here..."
                        className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={saveAction}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        <Check size={15} />
                        Save changes
                      </button>
                    </div>
                  </section>
                  <section>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                          Activity log
                        </p>
                        <h4 className="mt-0.5 text-base font-semibold">Client history</h4>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {action.activity?.length || 0} entries
                      </span>
                    </div>
                    <div className="mt-3 max-h-72 space-y-3 overflow-y-auto">
                      {[...(action.activity || [])].reverse().map((entry) => (
                        <div
                          key={entry._id}
                          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex justify-between">
                            <div>
                              <p className="text-sm font-semibold">
                                {entry.message || 'Status and remark updated'}
                              </p>
                              <p className="mt-0.5 text-xs font-medium text-blue-700">
                                Updated by{' '}
                                {entry.changedByName || entry.changedBy?.name || 'CRM user'}
                              </p>
                            </div>
                            <p className="text-xs text-slate-500">
                              {new Date(entry.changedAt).toLocaleString('en-IN')}
                            </p>
                          </div>
                          {entry.currentStatus && (
                            <div className="mt-3 w-64 rounded-lg bg-slate-50 p-3">
                              <p className="text-xs font-semibold text-slate-500">Status</p>
                              <p className="mt-1 text-sm text-slate-700">
                                {entry.previousStatus || 'Empty'} →{' '}
                                <strong>{entry.currentStatus}</strong>
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                      {!action.activity?.length && (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-600">
                          No activity yet
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Filter({ value, set, label, items }) {
  return (
    <select value={value} onChange={(e) => set(e.target.value)} className={field}>
      <option value="all">{label}</option>
      {items.map((x) => (
        <option key={x}>{x}</option>
      ))}
    </select>
  );
}
function Label({ children }) {
  return (
    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </span>
  );
}
function TH({ children, center }) {
  return (
    <th
      className={`whitespace-nowrap border border-slate-300 px-3 py-2 font-semibold text-slate-800 ${center ? 'text-center' : ''}`}
    >
      {children}
    </th>
  );
}
function TD({ children, center }) {
  return (
    <td
      className={`whitespace-nowrap border border-slate-300 px-3 py-2 text-slate-700 ${center ? 'text-center' : ''}`}
    >
      {children}
    </td>
  );
}
