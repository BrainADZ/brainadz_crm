import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Download,
  FilePlus2,
  FileText,
  Mail,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { getValidToken } from '../utils/auth';

const headers = () => ({
  Authorization: `Bearer ${getValidToken('admin') || getValidToken('employee') || ''}`,
});
const inputClass =
  'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-600';
const dateValue = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const idOf = (value) => String(value?._id || value || '');
const blankItem = () => ({
  description: '',
  quantity: '1',
  days: '1',
  unit: 'Unit',
  unitRate: '',
  taxRate: '18',
});
const UNIT_OPTIONS = ['Unit', 'Square Feet', 'Meter', 'Lot'];
const STATUS_STYLES = {
  Draft: 'bg-amber-50 text-amber-700',
  Sent: 'bg-blue-50 text-blue-700',
  Accepted: 'bg-emerald-50 text-emerald-700',
  Rejected: 'bg-red-50 text-red-700',
  Expired: 'bg-slate-100 text-slate-600',
};
const MARKETING_SERVICES = [
  'Social Media Marketing',
  'Paid Advertising',
  'SEO',
  'Content Marketing',
  'Email Marketing',
  'Website Optimization',
];
const blankForm = () => ({
  businessUnitId: '',
  departmentId: '',
  clientName: '',
  clientCompany: '',
  clientEmail: '',
  clientPhone: '',
  clientAddress: '',
  subject: '',
  quotationMode: 'sale',
  documentType: 'quotation',
  proposalServices: [],
  deliverables: [''],
  companyGstin: '',
  companyAddress: 'Apex Square III, UGF, Plot 6, Pocket B-3, Sector 17, Dwarka, New Delhi 110075',
  quotationDate: dateValue(),
  validUntil: dateValue(15),
  customFields: [],
  items: [blankItem()],
  discountType: 'percentage',
  discountValue: '0',
  notes: '',
  terms:
    'Prices are valid until the document expiry date.\nWork begins after written approval and agreed advance payment.\nMedia budgets and third-party costs are billed separately unless included in the costing.',
});
const money = (value) =>
  `\u20B9${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ProposalOptions = ({ active, form, setForm }) => {
  const [customService, setCustomService] = useState('');
  if (!active) return null;
  const toggleService = (service) =>
    setForm((current) => ({
      ...current,
      proposalServices: current.proposalServices.includes(service)
        ? current.proposalServices.filter((item) => item !== service)
        : [...current.proposalServices, service],
    }));
  const updateDeliverable = (index, value) =>
    setForm((current) => ({
      ...current,
      deliverables: current.deliverables.map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
    }));
  const addCustomService = () => {
    const service = customService.trim();
    if (!service || form.proposalServices.includes(service)) return;
    setForm((current) => ({
      ...current,
      proposalServices: [...current.proposalServices, service],
    }));
    setCustomService('');
  };
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-950">Marketing proposal scope</h3>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              AUTO ACTIVATED
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Marketing department selected. Choose any services, then define client-specific
            deliverables.
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-400">Variable section</span>
      </div>
      <div className="grid gap-6 p-5 lg:grid-cols-2">
        <div>
          <span className={labelClass}>Marketing services *</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {MARKETING_SERVICES.map((service) => (
              <button
                key={service}
                type="button"
                onClick={() => toggleService(service)}
                className={`flex min-h-11 items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition ${form.proposalServices.includes(service) ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50/40'}`}
              >
                <span>{service}</span>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${form.proposalServices.includes(service) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                >
                  {form.proposalServices.includes(service) ? '✓' : '+'}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={customService}
              onChange={(event) => setCustomService(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addCustomService();
                }
              }}
              placeholder="Other service, e.g. Influencer Marketing"
              className={inputClass}
            />
            <button
              type="button"
              onClick={addCustomService}
              className="shrink-0 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Add
            </button>
          </div>
          {form.proposalServices.filter((service) => !MARKETING_SERVICES.includes(service)).length >
            0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {form.proposalServices
                .filter((service) => !MARKETING_SERVICES.includes(service))
                .map((service) => (
                  <button
                    key={service}
                    type="button"
                    onClick={() => toggleService(service)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
                  >
                    {service}
                    <X size={12} />
                  </button>
                ))}
            </div>
          )}
        </div>
        <div>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <span className={labelClass}>Client deliverables *</span>
              <p className="text-xs text-slate-500">
                Only these points and costing usually change.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setForm((current) => ({ ...current, deliverables: [...current.deliverables, ''] }))
              }
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              <Plus size={14} />
              Add deliverable
            </button>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {form.deliverables.map((item, index) => (
              <div key={index} className="grid grid-cols-[2rem_1fr_2.5rem] items-center gap-2">
                <span className="flex h-10 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                  {index + 1}
                </span>
                <input
                  required
                  value={item}
                  onChange={(event) => updateDeliverable(index, event.target.value)}
                  placeholder="e.g. 15 posts per month"
                  className={inputClass}
                />
                <button
                  type="button"
                  disabled={form.deliverables.length === 1}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      deliverables: current.deliverables.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    }))
                  }
                  className="inline-flex h-10 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-30"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const Quotations = () => {
  const [quotations, setQuotations] = useState([]);
  const [options, setOptions] = useState({ businessUnits: [], departments: [], actions: [] });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState('');
  const [updatingStatusId, setUpdatingStatusId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const updateForm = (changes) => setForm((current) => ({ ...current, ...changes }));

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [quotationResponse, optionResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/quotations`, { headers: headers() }),
        axios.get(`${API_BASE_URL}/api/quotations/options`, { headers: headers() }),
      ]);
      setQuotations(quotationResponse.data || []);
      setOptions(optionResponse.data || { businessUnits: [], departments: [], actions: [] });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load quotations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const subtotal = form.items.reduce(
      (total, item) =>
        total +
        (Number(item.quantity) || 0) *
          (form.quotationMode === 'rental' ? Number(item.days) || 0 : 1) *
          (Number(item.unitRate) || 0),
      0,
    );
    const discountValue = Math.max(0, Number(form.discountValue) || 0);
    const discount =
      form.discountType === 'fixed'
        ? Math.min(subtotal, discountValue)
        : Math.min(subtotal, (subtotal * Math.min(discountValue, 100)) / 100);
    const taxable = subtotal - discount;
    const ratio = subtotal ? taxable / subtotal : 0;
    const tax =
      form.items.reduce(
        (total, item) =>
          total +
          ((Number(item.quantity) || 0) *
            (form.quotationMode === 'rental' ? Number(item.days) || 0 : 1) *
            (Number(item.unitRate) || 0) *
            (Number(item.taxRate) || 0)) /
            100,
        0,
      ) * ratio;
    return { subtotal, discount, taxable, tax, grandTotal: taxable + tax };
  }, [form.discountType, form.discountValue, form.items, form.quotationMode]);

  const filtered = useMemo(
    () =>
      quotations.filter((quotation) => {
        const query = search.trim().toLowerCase();
        return (
          (statusFilter === 'all' || quotation.status === statusFilter) &&
          (!query ||
            [
              quotation.quotationNumber,
              quotation.clientName,
              quotation.clientCompany,
              quotation.clientEmail,
              quotation.subject,
              quotation.businessUnitId?.name,
              quotation.createdBy?.name,
            ].some((value) =>
              String(value || '')
                .toLowerCase()
                .includes(query),
            ))
        );
      }),
    [quotations, search, statusFilter],
  );

  const openCreate = () => {
    const unit = options.businessUnits[0];
    const department =
      options.departments.find((item) =>
        (item.businessUnitIds || []).map(idOf).includes(idOf(unit)),
      ) || options.departments[0];
    setEditingId('');
    setForm({ ...blankForm(), businessUnitId: idOf(unit), departmentId: idOf(department) });
    setError('');
    setModalOpen(true);
  };
  const openEdit = (quotation) => {
    setEditingId(quotation._id);
    setForm({
      ...blankForm(),
      businessUnitId: idOf(quotation.businessUnitId),
      departmentId: idOf(quotation.departmentId),
      clientName: quotation.clientName || '',
      clientCompany: quotation.clientCompany || '',
      clientEmail: quotation.clientEmail || '',
      clientPhone: quotation.clientPhone || '',
      clientAddress: quotation.clientAddress || '',
      subject: quotation.subject || '',
      quotationMode: quotation.quotationMode || 'sale',
      documentType: quotation.documentType || 'quotation',
      proposalServices: quotation.proposalServices || [],
      deliverables: quotation.deliverables?.length ? [...quotation.deliverables] : [''],
      companyGstin: quotation.companyGstin || '',
      companyAddress:
        quotation.companyAddress ||
        'Apex Square III, UGF, Plot 6, Pocket B-3, Sector 17, Dwarka, New Delhi 110075',
      quotationDate: quotation.quotationDate || dateValue(),
      validUntil: quotation.validUntil || dateValue(15),
      customFields: (quotation.customFields || []).map((field) => ({
        label: field.label || '',
        value: field.value || '',
      })),
      items: (quotation.items || []).map((item) => ({
        description: item.description || '',
        quantity: String(item.quantity ?? 1),
        days: String(item.days ?? 1),
        unit: item.unit || 'Unit',
        unitRate: String(item.unitRate ?? ''),
        taxRate: String(item.taxRate ?? 18),
      })),
      discountType: quotation.discountType || 'percentage',
      discountValue: String(quotation.discountValue ?? 0),
      notes: quotation.notes || '',
      terms: quotation.terms || '',
    });
    setError('');
    setMessage('');
    setModalOpen(true);
  };
  const selectedDepartment = options.departments.find(
    (department) => idOf(department) === form.departmentId,
  );
  const selectedBusinessUnit = options.businessUnits.find(
    (unit) => idOf(unit) === form.businessUnitId,
  );
  const liveBusinessUnit = selectedBusinessUnit?.legacyCommunityKey === 'live';
  const marketingDepartment = /marketing/i.test(
    `${selectedDepartment?.name || ''} ${selectedDepartment?.slug || ''}`,
  );
  useEffect(() => {
    setForm((current) => {
      const documentType = marketingDepartment ? 'marketing-proposal' : 'quotation';
      if (current.documentType === documentType) return current;
      const subject =
        marketingDepartment && !current.subject
          ? 'Digital Marketing Proposal'
          : !marketingDepartment && current.subject === 'Digital Marketing Proposal'
            ? ''
            : current.subject;
      return { ...current, documentType, subject };
    });
  }, [marketingDepartment]);
  const updateItem = (index, changes) =>
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...changes } : item,
      ),
    }));
  const createQuotation = async (event) => {
    event.preventDefault();
    if (marketingDepartment && !form.proposalServices.length) {
      setError('Select at least one marketing service or add a custom service.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = editingId
        ? await axios.put(`${API_BASE_URL}/api/quotations/${editingId}`, form, {
            headers: headers(),
          })
        : await axios.post(`${API_BASE_URL}/api/quotations`, form, { headers: headers() });
      setQuotations((current) =>
        editingId
          ? current.map((item) => (item._id === editingId ? response.data.quotation : item))
          : [response.data.quotation, ...current],
      );
      setMessage(response.data.message);
      setEditingId('');
      setModalOpen(false);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          `Unable to ${editingId ? 'update' : 'create'} quotation`,
      );
    } finally {
      setSaving(false);
    }
  };

  const previewPdf = async (quotation) => {
    setError('');
    try {
      const response = await axios.get(`${API_BASE_URL}/api/quotations/${quotation._id}/pdf`, {
        headers: headers(),
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to generate quotation PDF');
    }
  };

  const sendQuotation = async (quotation) => {
    if (!window.confirm(`Send ${quotation.quotationNumber} to ${quotation.clientEmail}?`)) return;
    setSendingId(quotation._id);
    setError('');
    setMessage('');
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/quotations/${quotation._id}/send`,
        {},
        { headers: headers() },
      );
      setQuotations((current) =>
        current.map((item) => (item._id === quotation._id ? response.data.quotation : item)),
      );
      setMessage(response.data.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to send quotation email');
    } finally {
      setSendingId('');
    }
  };

  const updateStatus = async (quotation, status) => {
    if (status === quotation.status || updatingStatusId || sendingId) return;
    setUpdatingStatusId(quotation._id);
    setError('');
    setMessage('');
    try {
      const response = await axios.patch(
        `${API_BASE_URL}/api/quotations/${quotation._id}/status`,
        { status },
        { headers: headers() },
      );
      setQuotations((current) =>
        current.map((item) => (item._id === quotation._id ? response.data.quotation : item)),
      );
      setMessage(response.data.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update quotation status');
    } finally {
      setUpdatingStatusId('');
    }
  };

  const stats = [
    ['Total quotations', quotations.length],
    ['Draft', quotations.filter((item) => item.status === 'Draft').length],
    ['Sent', quotations.filter((item) => item.status === 'Sent').length],
    ['Quoted value', money(quotations.reduce((total, item) => total + item.grandTotal, 0))],
  ];

  return (
    <div className="mx-auto max-w-[96rem] space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            Sales documents
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Quotations</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create branded quotations for Marketing, Exhibits and Live clients.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative sm:w-72">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search quotations..."
              className={`${inputClass} pl-9`}
            />
          </label>
          {options.actions.includes('create') && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <FilePlus2 size={17} />
              New Quotation
            </button>
          )}
        </div>
      </header>
      {(message || error) && (
        <div
          className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
        >
          <span>{error || message}</span>
          <button
            type="button"
            onClick={() => {
              setMessage('');
              setError('');
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value]) => (
          <article
            key={label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
          </article>
        ))}
      </section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div>
            <h2 className="font-semibold text-slate-950">Quotation register</h2>
            <p className="mt-1 text-xs text-slate-500">{filtered.length} records</p>
            {options.actions.includes('update') && (
              <p className="mt-1 text-xs text-slate-500">
                Change status in the table. Use Send to email the client and mark it Sent
                automatically.
              </p>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter quotations by status"
            className="h-10 w-40 shrink-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">All Status</option>
            {Object.keys(STATUS_STYLES).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="compact-crm-table min-w-[62rem] w-full text-left">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Quotation</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Business Unit</th>
                <th className="px-4 py-3">Created by</th>
                <th className="px-4 py-3">Validity</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((quotation) => (
                <tr key={quotation._id} className="hover:bg-blue-50/30">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-blue-700">{quotation.quotationNumber}</p>
                    <p className="mt-1 max-w-60 truncate text-xs text-slate-500">
                      {quotation.subject}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">
                      {quotation.clientCompany || quotation.clientName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{quotation.clientEmail}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-700">{quotation.businessUnitId?.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{quotation.departmentId?.name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-700">{quotation.createdBy?.name}</p>
                    <p className="text-xs text-slate-500">{quotation.createdBy?.employeeId}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {quotation.quotationDate}
                    <span className="block">to {quotation.validUntil}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {money(quotation.grandTotal)}
                  </td>
                  <td className="px-4 py-3">
                    {options.actions.includes('update') ? (
                      <div>
                        <select
                          aria-label={`Status for ${quotation.quotationNumber}`}
                          value={quotation.status}
                          onChange={(event) => updateStatus(quotation, event.target.value)}
                          disabled={Boolean(updatingStatusId || sendingId)}
                          className={`h-9 min-w-28 rounded-lg border border-current/20 px-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-wait disabled:opacity-50 ${STATUS_STYLES[quotation.status] || STATUS_STYLES.Draft}`}
                        >
                          {Object.keys(STATUS_STYLES).map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        {updatingStatusId === quotation._id && (
                          <p role="status" className="mt-1 text-xs text-slate-500">
                            Saving...
                          </p>
                        )}
                      </div>
                    ) : (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[quotation.status] || STATUS_STYLES.Draft}`}
                      >
                        {quotation.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {options.actions.includes('update') && (
                        <button
                          type="button"
                          title="Edit quotation"
                          disabled={Boolean(updatingStatusId || sendingId)}
                          onClick={() => openEdit(quotation)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50"
                        >
                          <Pencil size={15} />
                        </button>
                      )}
                      <button
                        type="button"
                        title="Preview PDF"
                        onClick={() => previewPdf(quotation)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                      >
                        <Download size={15} />
                      </button>
                      <button
                        type="button"
                        title="Send to client"
                        onClick={() => sendQuotation(quotation)}
                        disabled={
                          Boolean(sendingId || updatingStatusId) ||
                          !options.actions.includes('create')
                        }
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        <Send size={14} />
                        {sendingId === quotation._id ? 'Sending' : 'Send'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !filtered.length && (
                <tr>
                  <td colSpan="8" className="px-4 py-16 text-center">
                    <FileText size={30} className="mx-auto text-slate-300" />
                    <p className="mt-3 font-semibold text-slate-600">No quotations found</p>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan="8" className="px-4 py-16 text-center text-slate-500">
                    Loading quotations...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={createQuotation}
            className="max-h-[94vh] w-full max-w-7xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          >
            <div className="sticky top-0 z-20 flex items-start justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                  Proposal & quotation builder
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">
                  {editingId ? 'Edit document' : 'Create a professional document'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {editingId
                    ? 'Update the details below and save your changes. Edited documents return to Draft status.'
                    : 'Choose a template, customize the variable scope and add pricing.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={19} />
              </button>
            </div>
            <div className="space-y-7 p-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                    Step 1
                  </p>
                  <h3 className="mt-1 font-semibold text-slate-950">Document setup</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    The selected department automatically controls the document format.
                  </p>
                </div>
                {liveBusinessUnit && (
                  <div className="mb-5 grid w-full max-w-sm grid-cols-2 rounded-xl bg-slate-100 p-1">
                    {[
                      ['sale', 'Sale'],
                      ['rental', 'Rental'],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => updateForm({ quotationMode: value })}
                        className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${form.quotationMode === value ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <label>
                    <span className={labelClass}>Business Unit *</span>
                    <select
                      required
                      value={form.businessUnitId}
                      onChange={(event) => {
                        const businessUnitId = event.target.value;
                        const department = options.departments.find((item) =>
                          (item.businessUnitIds || []).map(idOf).includes(businessUnitId),
                        );
                        const unit = options.businessUnits.find(
                          (item) => idOf(item) === businessUnitId,
                        );
                        updateForm({
                          businessUnitId,
                          departmentId: idOf(department),
                          quotationMode:
                            unit?.legacyCommunityKey === 'live' ? form.quotationMode : 'sale',
                        });
                      }}
                      className={inputClass}
                    >
                      <option value="">Select</option>
                      {options.businessUnits.map((unit) => (
                        <option key={unit._id} value={unit._id}>
                          {unit.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className={labelClass}>Document date *</span>
                    <input
                      required
                      type="date"
                      value={form.quotationDate}
                      onChange={(event) => updateForm({ quotationDate: event.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <label>
                    <span className={labelClass}>Valid until *</span>
                    <input
                      required
                      type="date"
                      min={form.quotationDate}
                      value={form.validUntil}
                      onChange={(event) => updateForm({ validUntil: event.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <label className="sm:col-span-2 lg:col-span-3">
                    <span className={labelClass}>Subject *</span>
                    <input
                      required
                      value={form.subject}
                      onChange={(event) => updateForm({ subject: event.target.value })}
                      placeholder="e.g. SEO & performance marketing proposal"
                      className={inputClass}
                    />
                  </label>
                  <label>
                    <span className={labelClass}>Company GSTIN</span>
                    <input
                      value={form.companyGstin}
                      onChange={(event) => updateForm({ companyGstin: event.target.value })}
                      placeholder="Enter company GSTIN"
                      className={inputClass}
                    />
                  </label>
                  <label className="sm:col-span-2 lg:col-span-2">
                    <span className={labelClass}>Company address</span>
                    <input
                      value={form.companyAddress}
                      onChange={(event) => updateForm({ companyAddress: event.target.value })}
                      className={inputClass}
                    />
                  </label>
                </div>
              </section>
              <ProposalOptions active={marketingDepartment} form={form} setForm={setForm} />
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Client details</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <label>
                    <span className={labelClass}>Client name *</span>
                    <input
                      required
                      value={form.clientName}
                      onChange={(event) => updateForm({ clientName: event.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <label>
                    <span className={labelClass}>Company</span>
                    <input
                      value={form.clientCompany}
                      onChange={(event) => updateForm({ clientCompany: event.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <label>
                    <span className={labelClass}>Email *</span>
                    <input
                      required
                      type="email"
                      value={form.clientEmail}
                      onChange={(event) => updateForm({ clientEmail: event.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <label>
                    <span className={labelClass}>Phone</span>
                    <input
                      value={form.clientPhone}
                      onChange={(event) => updateForm({ clientPhone: event.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <label className="sm:col-span-2 lg:col-span-4">
                    <span className={labelClass}>Billing address</span>
                    <input
                      value={form.clientAddress}
                      onChange={(event) => updateForm({ clientAddress: event.target.value })}
                      className={inputClass}
                    />
                  </label>
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                      Step 3
                    </p>
                    <h3 className="mt-1 font-semibold text-slate-950">Quotation items</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        items: [...current.items, blankItem()],
                      }))
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700"
                  >
                    <Plus size={14} />
                    Add item
                  </button>
                </div>
                <div className="space-y-2">
                  {form.items.map((item, index) => (
                    <div
                      key={index}
                      className={`grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 ${liveBusinessUnit && form.quotationMode === 'rental' ? 'lg:grid-cols-[minmax(14rem,1fr)_5rem_5rem_7rem_7rem_5rem_8rem_2.5rem]' : 'lg:grid-cols-[minmax(16rem,1fr)_6rem_8rem_8rem_6rem_8rem_2.5rem]'}`}
                    >
                      <label>
                        <span className={labelClass}>Description *</span>
                        <input
                          required
                          value={item.description}
                          onChange={(event) =>
                            updateItem(index, { description: event.target.value })
                          }
                          className={inputClass}
                        />
                      </label>
                      {liveBusinessUnit && form.quotationMode === 'rental' && (
                        <label>
                          <span className={labelClass}>Days</span>
                          <input
                            required
                            min="1"
                            step="1"
                            type="number"
                            value={item.days}
                            onChange={(event) => updateItem(index, { days: event.target.value })}
                            className={inputClass}
                          />
                        </label>
                      )}
                      <label>
                        <span className={labelClass}>Qty / Area</span>
                        <input
                          required
                          min="0.01"
                          step="0.01"
                          type="number"
                          value={item.quantity}
                          onChange={(event) => updateItem(index, { quantity: event.target.value })}
                          className={inputClass}
                        />
                      </label>
                      <label>
                        <span className={labelClass}>Unit</span>
                        <select
                          value={item.unit}
                          onChange={(event) => updateItem(index, { unit: event.target.value })}
                          className={inputClass}
                        >
                          {UNIT_OPTIONS.map((unit) => (
                            <option key={unit}>{unit}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className={labelClass}>Rate</span>
                        <input
                          required
                          min="0"
                          step="0.01"
                          type="number"
                          value={item.unitRate}
                          onChange={(event) => updateItem(index, { unitRate: event.target.value })}
                          className={inputClass}
                        />
                      </label>
                      <label>
                        <span className={labelClass}>GST %</span>
                        <input
                          required
                          min="0"
                          max="100"
                          step="0.01"
                          type="number"
                          value={item.taxRate}
                          onChange={(event) => updateItem(index, { taxRate: event.target.value })}
                          className={inputClass}
                        />
                      </label>
                      <div>
                        <span className={labelClass}>Amount</span>
                        <div className="flex h-10 items-center justify-end rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold">
                          {money(
                            (Number(item.quantity) || 0) *
                              (liveBusinessUnit && form.quotationMode === 'rental'
                                ? Number(item.days) || 0
                                : 1) *
                              (Number(item.unitRate) || 0),
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={form.items.length === 1}
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            items: current.items.filter((_, itemIndex) => itemIndex !== index),
                          }))
                        }
                        className="mt-6 inline-flex h-10 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-30"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
              <section className="grid gap-5 lg:grid-cols-[1fr_22rem]">
                <div className="space-y-4">
                  <details
                    open
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                  >
                    <summary className="cursor-pointer bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800">
                      Notes
                    </summary>
                    <div className="border-t border-slate-200 p-4">
                      <label className="block">
                        <span className={labelClass}>Quotation notes</span>
                        <textarea
                          rows="5"
                          value={form.notes}
                          onChange={(event) => updateForm({ notes: event.target.value })}
                          placeholder="Add one note per line"
                          className={`${inputClass} h-auto py-3`}
                        />
                        <span className="mt-1 block text-[11px] text-slate-500">
                          Add one note per line. Notes will appear as bullet points in the PDF.
                        </span>
                      </label>
                    </div>
                  </details>
                  <details
                    open
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                  >
                    <summary className="cursor-pointer bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800">
                      Payment terms & account details
                    </summary>
                    <div className="space-y-4 border-t border-slate-200 p-4">
                      <label className="block">
                        <span className={labelClass}>Payment terms</span>
                        <textarea
                          rows="5"
                          value={form.terms}
                          onChange={(event) => updateForm({ terms: event.target.value })}
                          placeholder="Add one payment term per line"
                          className={`${inputClass} h-auto py-3`}
                        />
                        <span className="mt-1 block text-[11px] text-slate-500">
                          Add one term per line. It will appear as a list in the PDF.
                        </span>
                      </label>
                      {liveBusinessUnit && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-blue-800">
                            Account details
                          </p>
                          <div className="mt-2 grid gap-1 text-xs text-slate-800 sm:grid-cols-2">
                            <p>
                              <strong>A/c Holder:</strong> Brainadz Live Pvt. Ltd.
                            </p>
                            <p>
                              <strong>Bank:</strong> ICICI Bank
                            </p>
                            <p>
                              <strong>A/c No.:</strong> 057105004479
                            </p>
                            <p>
                              <strong>IFSC:</strong> ICIC0000571
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </details>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Quotation total</h3>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <select
                      value={form.discountType}
                      onChange={(event) => updateForm({ discountType: event.target.value })}
                      className={inputClass}
                    >
                      <option value="percentage">Discount %</option>
                      <option value="fixed">Fixed discount</option>
                    </select>
                    <input
                      min="0"
                      type="number"
                      value={form.discountValue}
                      onChange={(event) => updateForm({ discountValue: event.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    <p className="flex justify-between text-slate-600">
                      <span>Subtotal</span>
                      <span>{money(totals.subtotal)}</span>
                    </p>
                    <p className="flex justify-between text-slate-600">
                      <span>Discount</span>
                      <span>- {money(totals.discount)}</span>
                    </p>
                    <p className="flex justify-between text-slate-600">
                      <span>GST</span>
                      <span>{money(totals.tax)}</span>
                    </p>
                    <p className="flex justify-between border-t border-slate-300 pt-3 text-base font-semibold text-blue-700">
                      <span>Grand total</span>
                      <span>{money(totals.grandTotal)}</span>
                    </p>
                  </div>
                </div>
              </section>
              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </p>
              )}
            </div>
            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {editingId ? <Pencil size={16} /> : <Mail size={16} />}
                {saving
                  ? editingId
                    ? 'Saving...'
                    : 'Creating...'
                  : editingId
                    ? 'Save Changes'
                    : 'Create Draft'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Quotations;
