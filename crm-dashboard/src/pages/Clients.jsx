import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import { getAuthenticatedRole, getValidToken } from '../utils/auth';

const getAuthHeaders = () => ({
  Authorization: `Bearer ${getValidToken('admin') || getValidToken('employee') || ''}`,
});

const priorityOptions = ['Low', 'Medium', 'High'];
const labelOptions = [
  'Prospect List',
  'Hot Accounts',
  'Follow Up',
  'Event Leads',
  'Partner Leads',
  'Renewals',
];
const stageOptions = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Won', 'Lost'];
const salesTableFormats = {
  marketing: [
    'Sr. No.',
    'Company Name',
    'Client Name',
    'City',
    'Designation / Department',
    'Mobile 1',
    'Mobile 2',
    'Email 1',
    'Email 2',
    'Website',
  ],
  live: [
    'Date',
    'MR Name',
    'Full Name',
    'Email',
    'Phone Number',
    'City',
    'Targeted State',
    'Your Requirement',
    'Source',
    'Product',
  ],
};

const emptyImportForm = {
  businessUnitId: '',
  name: '',
  year: new Date().getFullYear().toString(),
  label: 'Prospect List',
  priority: 'Medium',
  source: 'Excel Import',
  ownerAlias: 'Admin',
  salesStage: 'Prospecting',
};

const iconButtonClass =
  'inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100 hover:text-blue-700';
const fieldClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const labelClass = 'mb-1.5 block text-xs font-bold text-slate-600';
const smallIconClass = 'h-4 w-4 fill-none stroke-current';

const priorityClass = {
  High: 'border-red-200 bg-red-50 text-red-700',
  Medium: 'border-amber-200 bg-amber-50 text-amber-700',
  Low: 'border-slate-200 bg-slate-50 text-slate-600',
};

const getSummary = (dataset) =>
  dataset.summary || {
    totalRows: dataset.rowCount || 0,
    assignedRows: 0,
    unassignedRows: dataset.rowCount || 0,
    openRows: dataset.rowCount || 0,
    contactedRows: 0,
    followUpRows: 0,
    interestedRows: 0,
    convertedRows: 0,
    lostRows: 0,
    untouchedRows: dataset.rowCount || 0,
    conversionRate: 0,
  };

const Modal = ({ title, eyebrow, children, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
    <section className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="shrink-0 flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          {eyebrow && (
            <p className="text-xs font-bold uppercase tracking-wide text-blue-600">{eyebrow}</p>
          )}
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        </div>
        <button type="button" onClick={onClose} className={iconButtonClass} aria-label="Close">
          <svg
            viewBox="0 0 24 24"
            className={smallIconClass}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </section>
  </div>
);

const DatasetFormFields = ({
  formData,
  setFormData,
  includeFile = false,
  file,
  setFile,
  businessUnits = [],
}) => (
  <div className="grid gap-4 sm:grid-cols-2">
    {includeFile && (
      <label className="block sm:col-span-2">
        <span className={labelClass}>Business Unit</span>
        <select
          className={fieldClass}
          value={formData.businessUnitId}
          onChange={(event) =>
            setFormData((previous) => ({ ...previous, businessUnitId: event.target.value }))
          }
          required
        >
          <option value="">Select where this data belongs</option>
          {businessUnits.map((unit) => (
            <option key={unit._id} value={unit._id}>
              {unit.name}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-slate-500">
          Employees can only receive data from their assigned Business Unit.
        </span>
      </label>
    )}
    {includeFile &&
      formData.businessUnitId &&
      (() => {
        const selectedUnit = businessUnits.find((unit) => unit._id === formData.businessUnitId);
        const columns = salesTableFormats[selectedUnit?.legacyCommunityKey];
        return (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 sm:col-span-2">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
              Required sheet format
            </p>
            <p className="mt-1 text-xs leading-5 text-blue-900">
              {columns
                ? `${columns.join('  •  ')}  •  Status  •  Remark  •  Assign`
                : 'Exhibits: existing sheet columns will remain unchanged. Status, Remark and Assign will be added at the end.'}
            </p>
          </div>
        );
      })()}
    <label className="block sm:col-span-2">
      <span className={labelClass}>Account list name</span>
      <input
        className={fieldClass}
        value={formData.name}
        onChange={(event) => setFormData((previous) => ({ ...previous, name: event.target.value }))}
        placeholder="e.g. Noida Expo Accounts"
        required
      />
    </label>
    <label className="block">
      <span className={labelClass}>Year</span>
      <input
        className={fieldClass}
        value={formData.year}
        onChange={(event) => setFormData((previous) => ({ ...previous, year: event.target.value }))}
        placeholder="2026"
      />
    </label>
    <label className="block">
      <span className={labelClass}>Account owner alias</span>
      <input
        className={fieldClass}
        value={formData.ownerAlias}
        onChange={(event) =>
          setFormData((previous) => ({ ...previous, ownerAlias: event.target.value }))
        }
        placeholder="Admin"
      />
    </label>
    <label className="block">
      <span className={labelClass}>Sales label</span>
      <select
        className={fieldClass}
        value={formData.label}
        onChange={(event) =>
          setFormData((previous) => ({ ...previous, label: event.target.value }))
        }
      >
        {labelOptions.map((label) => (
          <option key={label}>{label}</option>
        ))}
      </select>
    </label>
    <label className="block">
      <span className={labelClass}>Priority</span>
      <select
        className={fieldClass}
        value={formData.priority}
        onChange={(event) =>
          setFormData((previous) => ({ ...previous, priority: event.target.value }))
        }
      >
        {priorityOptions.map((priority) => (
          <option key={priority}>{priority}</option>
        ))}
      </select>
    </label>
    <label className="block">
      <span className={labelClass}>Sales stage</span>
      <select
        className={fieldClass}
        value={formData.salesStage}
        onChange={(event) =>
          setFormData((previous) => ({ ...previous, salesStage: event.target.value }))
        }
      >
        {stageOptions.map((stage) => (
          <option key={stage}>{stage}</option>
        ))}
      </select>
    </label>
    <label className="block">
      <span className={labelClass}>Lead source</span>
      <input
        className={fieldClass}
        value={formData.source}
        onChange={(event) =>
          setFormData((previous) => ({ ...previous, source: event.target.value }))
        }
        placeholder="Excel Import"
      />
    </label>
    {includeFile && (
      <label className="block rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-blue-300 hover:bg-blue-50/40 sm:col-span-2">
        <span className="block text-sm font-bold text-slate-800">Excel file</span>
        <span className="mt-1 block text-xs font-medium text-slate-500">
          {file?.name || 'Only .xlsx or .xls files'}
        </span>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(event) => setFile(event.target.files[0])}
          className="mt-3 block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-100 file:px-3 file:py-2 file:text-xs file:font-bold file:text-blue-700"
          required
        />
      </label>
    )}
  </div>
);

const Clients = () => {
  const [datasets, setDatasets] = useState([]);
  const [businessUnits, setBusinessUnits] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [salesActions, setSalesActions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [businessUnitFilter, setBusinessUnitFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [quickView, setQuickView] = useState('all');
  const [selectedDatasetIds, setSelectedDatasetIds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [editingDataset, setEditingDataset] = useState(null);
  const [importFormData, setImportFormData] = useState(emptyImportForm);
  const [labelFormData, setLabelFormData] = useState({
    label: 'Hot Accounts',
    priority: 'High',
    salesStage: 'Qualification',
  });
  const [assignFormData, setAssignFormData] = useState({
    employeeIds: [],
    assignmentMode: 'full',
    limit: '',
  });
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchDatasets = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_BASE_URL}/api/client-datasets`, {
        headers: getAuthHeaders(),
      });
      setDatasets(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load account lists');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDatasets();
    axios
      .get(`${API_BASE_URL}/api/client-datasets/options`, { headers: getAuthHeaders() })
      .then((response) => {
        setBusinessUnits(response.data.businessUnits || []);
        setEmployees(response.data.employees || []);
        setSalesActions(response.data.actions || []);
      })
      .catch((requestError) =>
        setError(requestError.response?.data?.message || 'Unable to load Business Units'),
      );
  }, [fetchDatasets]);

  const totals = useMemo(
    () =>
      datasets.reduce(
        (accumulator, dataset) => {
          const summary = getSummary(dataset);

          return {
            totalRows: accumulator.totalRows + summary.totalRows,
            assignedRows: accumulator.assignedRows + summary.assignedRows,
            openRows: accumulator.openRows + summary.openRows,
            contactedRows: accumulator.contactedRows + summary.contactedRows,
            followUpRows: accumulator.followUpRows + summary.followUpRows,
            interestedRows: accumulator.interestedRows + summary.interestedRows,
            convertedRows: accumulator.convertedRows + summary.convertedRows,
            lostRows: accumulator.lostRows + summary.lostRows,
            unassignedRows: accumulator.unassignedRows + summary.unassignedRows,
            untouchedRows: accumulator.untouchedRows + summary.untouchedRows,
          };
        },
        {
          totalRows: 0,
          assignedRows: 0,
          openRows: 0,
          contactedRows: 0,
          followUpRows: 0,
          interestedRows: 0,
          convertedRows: 0,
          lostRows: 0,
          unassignedRows: 0,
          untouchedRows: 0,
        },
      ),
    [datasets],
  );

  const filterOptions = useMemo(() => {
    const unique = (values) =>
      [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      );

    return {
      owners: unique(datasets.map((dataset) => dataset.ownerAlias)),
      sources: unique(datasets.map((dataset) => dataset.source)),
    };
  }, [datasets]);

  const filteredDatasets = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return datasets.filter((dataset) => {
      const summary = getSummary(dataset);
      const matchesSearch =
        !normalizedSearch ||
        [
          dataset.name,
          dataset.year,
          dataset.originalFileName,
          dataset.label,
          dataset.priority,
          dataset.ownerAlias,
          dataset.salesStage,
          dataset.source,
          dataset.businessUnitName,
          dataset.communityKey,
          dataset.preview?.accountName,
          dataset.preview?.phone,
          dataset.preview?.website,
          dataset.preview?.billingCity,
          dataset.preview?.billingState,
        ].some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(normalizedSearch),
        );
      const matchesStage = stageFilter === 'all' || dataset.salesStage === stageFilter;
      const matchesPriority = priorityFilter === 'all' || dataset.priority === priorityFilter;
      const matchesBusinessUnit =
        businessUnitFilter === 'all' || String(dataset.businessUnitId || '') === businessUnitFilter;
      const matchesOwner = ownerFilter === 'all' || dataset.ownerAlias === ownerFilter;
      const matchesSource = sourceFilter === 'all' || dataset.source === sourceFilter;
      const matchesQuickView =
        quickView === 'all' ||
        (quickView === 'followup' && summary.followUpRows > 0) ||
        (quickView === 'unassigned' && summary.unassignedRows > 0) ||
        (quickView === 'untouched' && summary.untouchedRows > 0) ||
        (quickView === 'converted' && summary.convertedRows > 0) ||
        (quickView === 'hot' && dataset.priority === 'High');

      return (
        matchesSearch &&
        matchesStage &&
        matchesPriority &&
        matchesBusinessUnit &&
        matchesOwner &&
        matchesSource &&
        matchesQuickView
      );
    });
  }, [
    datasets,
    searchTerm,
    stageFilter,
    priorityFilter,
    businessUnitFilter,
    ownerFilter,
    sourceFilter,
    quickView,
  ]);

  const hasActiveFilters =
    Boolean(searchTerm.trim()) ||
    stageFilter !== 'all' ||
    priorityFilter !== 'all' ||
    businessUnitFilter !== 'all' ||
    ownerFilter !== 'all' ||
    sourceFilter !== 'all' ||
    quickView !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setStageFilter('all');
    setPriorityFilter('all');
    setBusinessUnitFilter('all');
    setOwnerFilter('all');
    setSourceFilter('all');
    setQuickView('all');
  };

  const selectedDatasets = datasets.filter((dataset) => selectedDatasetIds.includes(dataset._id));
  const isEmployeeWorkspace = getAuthenticatedRole() === 'employee';
  const datasetBasePath = isEmployeeWorkspace ? '/employee-dashboard/sales' : '/dashboard/clients';
  const canImport = salesActions.includes('import');
  const canUpdate = salesActions.includes('update');
  const canAssign = salesActions.includes('assign');
  const canDelete = salesActions.includes('delete');
  const allVisibleSelected =
    filteredDatasets.length > 0 &&
    filteredDatasets.every((dataset) => selectedDatasetIds.includes(dataset._id));
  const selectedBusinessUnitIds = [
    ...new Set(
      selectedDatasets.map((dataset) => String(dataset.businessUnitId || '')).filter(Boolean),
    ),
  ];
  const eligibleEmployees = employees.filter((employee) =>
    selectedBusinessUnitIds.every((unitId) => employee.businessUnitIds.includes(unitId)),
  );

  const upsertDatasets = (nextDatasets) => {
    setDatasets((previous) =>
      previous.map(
        (dataset) => nextDatasets.find((nextDataset) => nextDataset._id === dataset._id) || dataset,
      ),
    );
  };

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedDatasetIds((previous) =>
        previous.filter((id) => !filteredDatasets.some((dataset) => dataset._id === id)),
      );
      return;
    }

    setSelectedDatasetIds((previous) => [
      ...new Set([...previous, ...filteredDatasets.map((dataset) => dataset._id)]),
    ]);
  };

  const toggleDatasetSelection = (datasetId) => {
    setSelectedDatasetIds((previous) =>
      previous.includes(datasetId)
        ? previous.filter((id) => id !== datasetId)
        : [...previous, datasetId],
    );
  };

  const handleImport = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!file) {
      setError('Please choose an Excel file');
      return;
    }

    const uploadData = new FormData();
    Object.entries(importFormData).forEach(([key, value]) => uploadData.append(key, value));
    uploadData.append('file', file);

    setIsSaving(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/client-datasets/upload`, uploadData, {
        headers: getAuthHeaders(),
      });
      setDatasets((previous) => [response.data.dataset, ...previous]);
      setImportFormData(emptyImportForm);
      setFile(null);
      setIsImportModalOpen(false);
      setMessage(response.data.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Upload failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateDataset = async (event) => {
    event.preventDefault();
    if (!editingDataset) return;

    setIsSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await axios.patch(
        `${API_BASE_URL}/api/client-datasets/${editingDataset._id}`,
        editingDataset,
        {
          headers: getAuthHeaders(),
        },
      );

      upsertDatasets([response.data.dataset]);
      setEditingDataset(null);
      setMessage(response.data.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update account list');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDataset = async (dataset) => {
    setMessage('');
    setError('');

    const isConfirmed = window.confirm(
      `Delete "${dataset.name}" account list? This cannot be undone.`,
    );
    if (!isConfirmed) return;

    try {
      const response = await axios.delete(`${API_BASE_URL}/api/client-datasets/${dataset._id}`, {
        headers: getAuthHeaders(),
      });

      setDatasets((previous) =>
        previous.filter((currentDataset) => currentDataset._id !== dataset._id),
      );
      setSelectedDatasetIds((previous) => previous.filter((id) => id !== dataset._id));
      setMessage(response.data.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete account list');
    }
  };

  const handleAssignLabel = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    if (selectedDatasetIds.length === 0) {
      setError('Select at least one account list');
      return;
    }

    setIsSaving(true);
    try {
      const response = await axios.patch(
        `${API_BASE_URL}/api/client-datasets/labels/bulk`,
        {
          datasetIds: selectedDatasetIds,
          ...labelFormData,
        },
        {
          headers: getAuthHeaders(),
        },
      );

      upsertDatasets(response.data.datasets);
      setIsLabelModalOpen(false);
      setSelectedDatasetIds([]);
      setMessage(response.data.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to assign label');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssignData = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    if (!selectedDatasetIds.length) return setError('Select at least one account list');
    if (!assignFormData.employeeIds.length) return setError('Select at least one employee');
    if (
      assignFormData.assignmentMode === 'limited' &&
      (!Number.isInteger(Number(assignFormData.limit)) || Number(assignFormData.limit) < 1)
    )
      return setError('Enter a valid record limit');

    setIsSaving(true);
    try {
      const responses = await Promise.all(
        selectedDatasetIds.map((datasetId) =>
          axios.patch(
            `${API_BASE_URL}/api/client-datasets/${datasetId}/assign`,
            {
              employeeIds: assignFormData.employeeIds,
              assignmentMode: assignFormData.assignmentMode,
              limit:
                assignFormData.assignmentMode === 'limited'
                  ? Number(assignFormData.limit)
                  : undefined,
            },
            { headers: getAuthHeaders() },
          ),
        ),
      );
      const assignedCount = responses.reduce(
        (total, response) => total + (response.data.assignedCount || 0),
        0,
      );
      setIsAssignModalOpen(false);
      setAssignFormData({ employeeIds: [], assignmentMode: 'full', limit: '' });
      setSelectedDatasetIds([]);
      setMessage(
        `${assignedCount} data assignment${assignedCount === 1 ? '' : 's'} completed successfully`,
      );
      await fetchDatasets();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to assign data');
    } finally {
      setIsSaving(false);
    }
  };

  const downloadListCsv = () => {
    const headings = [
      'Account List',
      'Year',
      'Phone',
      'Website',
      'Billing City',
      'Billing State/Province',
      'Label',
      'Priority',
      'Stage',
      'Owner Alias',
      'Rows',
      'Open',
      'Follow Up',
      'Untouched',
      'Interested',
      'Converted',
      'Unassigned',
      'Conversion Rate',
      'Source',
    ];
    const rows = filteredDatasets.map((dataset) => {
      const summary = getSummary(dataset);
      return [
        dataset.name,
        dataset.year,
        dataset.preview?.phone,
        dataset.preview?.website,
        dataset.preview?.billingCity,
        dataset.preview?.billingState,
        dataset.label,
        dataset.priority,
        dataset.salesStage,
        dataset.ownerAlias,
        summary.totalRows,
        summary.openRows,
        summary.followUpRows,
        summary.untouchedRows,
        summary.interestedRows,
        summary.convertedRows,
        summary.unassignedRows,
        `${summary.conversionRate}%`,
        dataset.source,
      ];
    });
    const csv = [headings, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'account-lists.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full space-y-4">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 fill-none stroke-current"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 4h16v16H4z" />
              <path d="M4 10h16" />
              <path d="M10 4v16" />
            </svg>
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-500">Accounts</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-950">Clients</h1>
            </div>
            <p className="mt-4 text-xs font-medium text-slate-500">
              {filteredDatasets.length} item{filteredDatasets.length === 1 ? '' : 's'} • Sorted by
              Account Name • Updated a few seconds ago
            </p>
          </div>
        </div>

        {(canImport || canUpdate || canAssign) && (
          <div className="flex flex-wrap items-start justify-end gap-2">
            <div className="flex flex-wrap items-center gap-0 overflow-hidden rounded-full border border-slate-400 bg-white shadow-sm">
              {canImport && (
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="border-r border-slate-300 px-5 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
                >
                  Import
                </button>
              )}
              {canUpdate && (
                <button
                  type="button"
                  onClick={() => setIsLabelModalOpen(true)}
                  className={`${canAssign ? 'border-r border-slate-300' : ''} px-5 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-50`}
                >
                  Assign Label
                </button>
              )}
              {canAssign && (
                <button
                  type="button"
                  onClick={() => {
                    setAssignFormData({ employeeIds: [], assignmentMode: 'full', limit: '' });
                    setIsAssignModalOpen(true);
                  }}
                  className="px-5 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
                >
                  Assign Data
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          ['Total Records', totals.totalRows],
          ['Open Pipeline', totals.openRows],
          ['Follow-ups', totals.followUpRows],
          ['Converted', totals.convertedRows],
          ['Unassigned', totals.unassignedRows],
          ['Untouched', totals.untouchedRows],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-md border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Sales work queue</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">
              Jump directly to records that need sales attention.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ['all', 'All Lists', datasets.length],
              ['hot', 'High Priority', datasets.filter((dataset) => dataset.priority === 'High').length],
              ['followup', 'Follow-up', totals.followUpRows],
              ['unassigned', 'Unassigned', totals.unassignedRows],
              ['untouched', 'Untouched', totals.untouchedRows],
              ['converted', 'Converted', totals.convertedRows],
            ].map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                onClick={() => setQuickView(value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  quickView === value
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                {label} <span className="ml-1 opacity-80">{count}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {(message || error) && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm font-bold ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
        >
          {error || message}
        </div>
      )}

      <section className="overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
        <div className="space-y-3 border-b border-slate-300 bg-white px-4 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <label className="relative block w-full xl:max-w-sm xl:flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <svg viewBox="0 0 24 24" className={smallIconClass} strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              </span>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search account, owner, source, city..."
                className="h-9 w-full rounded-lg border border-slate-400 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <div className="grid flex-1 grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
              <select
                value={stageFilter}
                onChange={(event) => setStageFilter(event.target.value)}
                className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
              >
                <option value="all">All stages</option>
                {stageOptions.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
                className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
              >
                <option value="all">All priorities</option>
                {priorityOptions.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
              <select
                value={businessUnitFilter}
                onChange={(event) => setBusinessUnitFilter(event.target.value)}
                className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
              >
                <option value="all">All business units</option>
                {businessUnits.map((unit) => (
                  <option key={unit._id} value={String(unit._id)}>
                    {unit.name}
                  </option>
                ))}
              </select>
              <select
                value={ownerFilter}
                onChange={(event) => setOwnerFilter(event.target.value)}
                className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
              >
                <option value="all">All owners</option>
                {filterOptions.owners.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
              >
                <option value="all">All sources</option>
                {filterOptions.sources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span>{filteredDatasets.length} visible list{filteredDatasets.length === 1 ? '' : 's'}</span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="font-bold text-blue-700 hover:text-blue-900 hover:underline"
                >
                  Reset filters
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                title="Refresh"
                onClick={fetchDatasets}
                className={iconButtonClass}
              >
                <svg
                  viewBox="0 0 24 24"
                  className={smallIconClass}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                  <path d="M3 21v-5h5" />
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
              </button>
              <button
                type="button"
                title="Export filtered list"
                onClick={downloadListCsv}
                className={iconButtonClass}
              >
                <svg
                  viewBox="0 0 24 24"
                  className={smallIconClass}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3v12" />
                  <path d="m7 10 5 5 5-5" />
                  <path d="M4 21h16" />
                </svg>
              </button>
              <button
                type="button"
                title="Clear selection"
                onClick={() => setSelectedDatasetIds([])}
                className={iconButtonClass}
              >
                <svg
                  viewBox="0 0 24 24"
                  className={smallIconClass}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
              <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                {selectedDatasetIds.length} selected
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[86rem] w-full table-fixed border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="w-12 border-b border-r border-slate-300 px-4 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="w-64 border-b border-r border-slate-300 px-4 py-2 font-bold">
                  Account Name
                </th>
                <th className="w-44 border-b border-r border-slate-300 px-4 py-2 font-bold">
                  Business Unit
                </th>
                <th className="w-36 border-b border-r border-slate-300 px-4 py-2 font-bold">
                  Owner
                </th>
                <th className="w-28 border-b border-r border-slate-300 px-4 py-2 font-bold">
                  Priority
                </th>
                <th className="w-36 border-b border-r border-slate-300 px-4 py-2 font-bold">
                  Label
                </th>
                <th className="w-36 border-b border-r border-slate-300 px-4 py-2 font-bold">
                  Stage
                </th>
                <th className="w-28 border-b border-r border-slate-300 px-4 py-2 text-right font-bold">
                  Follow-up
                </th>
                <th className="w-28 border-b border-r border-slate-300 px-4 py-2 text-right font-bold">
                  Converted
                </th>
                <th className="w-32 border-b border-r border-slate-300 px-4 py-2 text-right font-bold">
                  Conversion
                </th>
                <th className="w-36 border-b border-r border-slate-300 px-4 py-2 font-bold">
                  Source
                </th>
                <th className="w-32 border-b border-slate-300 px-4 py-2 text-right font-bold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredDatasets.map((dataset) => {
                const summary = getSummary(dataset);

                return (
                  <tr key={dataset._id} className="bg-white transition hover:bg-blue-50/40">
                    <td className="border-b border-r border-slate-200 px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedDatasetIds.includes(dataset._id)}
                        onChange={() => toggleDatasetSelection(dataset._id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="border-b border-r border-slate-200 px-4 py-3">
                      <Link
                        to={`${datasetBasePath}/${dataset._id}`}
                        className="font-bold text-blue-700 hover:text-blue-900 hover:underline"
                      >
                        {dataset.name}
                      </Link>
                      <p className="mt-1 truncate text-xs font-medium text-slate-500">
                        {dataset.originalFileName || 'Manual account list'}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-400">
                        {summary.totalRows} records • {summary.assignedRows} assigned
                      </p>
                    </td>
                    <td className="border-b border-r border-slate-200 px-4 py-3">
                      <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                        {dataset.businessUnitName || dataset.communityKey || 'Legacy data'}
                      </span>
                    </td>
                    <td className="border-b border-r border-slate-200 px-4 py-3 font-semibold text-slate-700">
                      {dataset.ownerAlias || 'Unassigned'}
                    </td>
                    <td className="border-b border-r border-slate-200 px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${priorityClass[dataset.priority] || priorityClass.Medium}`}
                      >
                        {dataset.priority || 'Medium'}
                      </span>
                    </td>
                    <td className="border-b border-r border-slate-200 px-4 py-3 font-semibold text-slate-700">
                      {dataset.label || 'Prospect List'}
                    </td>
                    <td className="border-b border-r border-slate-200 px-4 py-3 font-semibold text-slate-700">
                      {dataset.salesStage || 'Prospecting'}
                    </td>
                    <td className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold text-amber-700">
                      {summary.followUpRows}
                    </td>
                    <td className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold text-emerald-700">
                      {summary.convertedRows}
                    </td>
                    <td className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold text-slate-900">
                      {summary.conversionRate}%
                    </td>
                    <td className="border-b border-r border-slate-200 px-4 py-3 text-xs font-semibold text-slate-600">
                      {dataset.source || '—'}
                    </td>
                    <td className="border-b border-slate-200 px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`${datasetBasePath}/${dataset._id}`}
                          title="Open account list"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-3.5 w-3.5 fill-none stroke-current"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M5 12h14" />
                            <path d="m13 6 6 6-6 6" />
                          </svg>
                        </Link>
                        {canUpdate && (
                          <button
                            type="button"
                            title="Edit"
                            onClick={() => setEditingDataset(dataset)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="h-3.5 w-3.5 fill-none stroke-current"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            title="Delete"
                            onClick={() => handleDeleteDataset(dataset)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="h-3.5 w-3.5 fill-none stroke-current"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2" />
                              <path d="M19 6 18 20H6L5 6" />
                              <path d="M10 11v5" />
                              <path d="M14 11v5" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!isLoading && filteredDatasets.length === 0 && (
                <tr>
                  <td colSpan="12" className="h-[34rem] px-4 py-20 text-center">
                    <div className="mx-auto flex max-w-md flex-col items-center">
                      <span className="flex h-28 w-28 items-center justify-center rounded-full bg-indigo-100 text-indigo-500">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-16 w-16 fill-none stroke-current"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M4 4h16v16H4z" />
                          <path d="M8 9h8" />
                          <path d="M8 13h5" />
                        </svg>
                      </span>
                      <h2 className="mt-6 text-xl font-semibold text-slate-700">
                        Accounts show where your contacts work
                      </h2>
                      <p className="mt-3 text-sm text-slate-500">
                        Import an Excel file to start tracking your sales pipeline.
                      </p>
                      {canImport && (
                        <button
                          type="button"
                          onClick={() => setIsImportModalOpen(true)}
                          className="mt-5 rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
                        >
                          Import Accounts
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {isLoading && (
                <tr>
                  <td
                    colSpan="12"
                    className="px-4 py-16 text-center text-sm font-semibold text-slate-500"
                  >
                    Loading account lists...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isImportModalOpen && (
        <Modal
          title="Import Accounts"
          eyebrow="Excel upload"
          onClose={() => setIsImportModalOpen(false)}
        >
          <form onSubmit={handleImport} className="space-y-5 p-5">
            <DatasetFormFields
              formData={importFormData}
              setFormData={setImportFormData}
              includeFile
              file={file}
              setFile={setFile}
              businessUnits={businessUnits}
            />
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:bg-slate-300"
              >
                {isSaving ? 'Importing...' : 'Import'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editingDataset && (
        <Modal
          title="Edit Account List"
          eyebrow={editingDataset.name}
          onClose={() => setEditingDataset(null)}
        >
          <form onSubmit={handleUpdateDataset} className="space-y-5 p-5">
            <DatasetFormFields formData={editingDataset} setFormData={setEditingDataset} />
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setEditingDataset(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:bg-slate-300"
              >
                {isSaving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {isLabelModalOpen && (
        <Modal
          title="Assign Sales Label"
          eyebrow={`${selectedDatasets.length} selected`}
          onClose={() => setIsLabelModalOpen(false)}
        >
          <form onSubmit={handleAssignLabel} className="space-y-5 p-5">
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
              This updates label, priority, and sales stage for selected account lists.
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className={labelClass}>Sales label</span>
                <select
                  className={fieldClass}
                  value={labelFormData.label}
                  onChange={(event) =>
                    setLabelFormData((previous) => ({ ...previous, label: event.target.value }))
                  }
                >
                  {labelOptions.map((label) => (
                    <option key={label}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClass}>Priority</span>
                <select
                  className={fieldClass}
                  value={labelFormData.priority}
                  onChange={(event) =>
                    setLabelFormData((previous) => ({ ...previous, priority: event.target.value }))
                  }
                >
                  {priorityOptions.map((priority) => (
                    <option key={priority}>{priority}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClass}>Sales stage</span>
                <select
                  className={fieldClass}
                  value={labelFormData.salesStage}
                  onChange={(event) =>
                    setLabelFormData((previous) => ({
                      ...previous,
                      salesStage: event.target.value,
                    }))
                  }
                >
                  {stageOptions.map((stage) => (
                    <option key={stage}>{stage}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setIsLabelModalOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || selectedDatasetIds.length === 0}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:bg-slate-300"
              >
                {isSaving ? 'Applying...' : 'Apply label'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {isAssignModalOpen && (
        <Modal
          title="Assign Data"
          eyebrow={`${selectedDatasets.length} account list${selectedDatasets.length === 1 ? '' : 's'} selected`}
          onClose={() => setIsAssignModalOpen(false)}
        >
          <form onSubmit={handleAssignData} className="space-y-5 p-5">
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
              Assign full, half or limited data from the selected account lists. For exact
              individual rows, open an account list and select those rows.
            </div>
            {!selectedDatasets.length && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                Select at least one account list from the table first.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Assignment mode</span>
                <select
                  className={fieldClass}
                  value={assignFormData.assignmentMode}
                  onChange={(event) =>
                    setAssignFormData((previous) => ({
                      ...previous,
                      assignmentMode: event.target.value,
                    }))
                  }
                >
                  <option value="full">Full data</option>
                  <option value="half">Half data</option>
                  <option value="limited">Limited records</option>
                </select>
              </label>
              {assignFormData.assignmentMode === 'limited' && (
                <label className="block">
                  <span className={labelClass}>Records per account list</span>
                  <input
                    type="number"
                    min="1"
                    className={fieldClass}
                    value={assignFormData.limit}
                    onChange={(event) =>
                      setAssignFormData((previous) => ({ ...previous, limit: event.target.value }))
                    }
                    placeholder="e.g. 25"
                    required
                  />
                </label>
              )}
            </div>
            <fieldset>
              <legend className={labelClass}>Employees (multiple allowed)</legend>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                {eligibleEmployees.map((employee) => {
                  const checked = assignFormData.employeeIds.includes(employee._id);
                  return (
                    <label
                      key={employee._id}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 ${checked ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}
                    >
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">
                          {employee.name || employee.email}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {employee.employeeId || employee.email}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setAssignFormData((previous) => ({
                            ...previous,
                            employeeIds: checked
                              ? previous.employeeIds.filter((id) => id !== employee._id)
                              : [...previous.employeeIds, employee._id],
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </label>
                  );
                })}
                {!eligibleEmployees.length && (
                  <p className="px-2 py-6 text-center text-sm font-semibold text-slate-500">
                    No employee has access to all selected Business Units.
                  </p>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                The same row can be assigned to more than one employee.
              </p>
            </fieldset>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  isSaving || !selectedDatasetIds.length || !assignFormData.employeeIds.length
                }
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:bg-slate-300"
              >
                {isSaving ? 'Assigning...' : 'Assign Data'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Clients;
