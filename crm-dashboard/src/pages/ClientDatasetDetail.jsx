import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { getAuthenticatedRole, getValidToken } from '../utils/auth';
import { API_BASE_URL } from '../config/api';

const CLIENT_WORK_COLUMNS = ['Status', 'Remark', 'Employee'];

const CLIENT_STATUS_OPTIONS = [
  'Pending',
  'Contacted',
  'Follow Up',
  'Interested',
  'Not Interested',
  'Converted',
  'Not Reachable',
];

const STATUS_SELECT_STYLES = {
  '': 'border-slate-300 bg-slate-50 text-slate-500',
  Pending: 'border-amber-300 bg-amber-100 text-amber-800',
  Contacted: 'border-sky-300 bg-sky-100 text-sky-800',
  'Follow Up': 'border-violet-300 bg-violet-100 text-violet-800',
  Interested: 'border-cyan-300 bg-cyan-100 text-cyan-800',
  'Not Interested': 'border-rose-300 bg-rose-100 text-rose-800',
  Converted: 'border-green-400 bg-green-100 text-green-900',
  'Not Reachable': 'border-orange-300 bg-orange-100 text-orange-800',
};

const STATUS_ROW_STYLES = {
  Pending: 'bg-amber-50/60',
  Contacted: 'bg-sky-50/60',
  'Follow Up': 'bg-violet-50/70',
  Interested: 'bg-cyan-50/70',
  'Not Interested': 'bg-rose-50/60',
  Converted: 'bg-green-100/70',
  'Not Reachable': 'bg-orange-50/60',
};

const getAuthToken = () =>
  getValidToken('admin') || getValidToken('employee');

const formatDate = (value) => {
  if (!value) return '';

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const getTodayDateKey = () => {
  const now = new Date();
  const localDate = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000,
  );

  return localDate.toISOString().slice(0, 10);
};

const normalizeColumnName = (column) =>
  String(column || '')
    .trim()
    .toLowerCase();

const getColumnIndex = (columns, columnName) =>
  columns.findIndex(
    (column) =>
      normalizeColumnName(column) === columnName.toLowerCase(),
  );

const normalizeContactHeader = (column) =>
  normalizeColumnName(column)
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isPhoneColumn = (column) => {
  const header = normalizeContactHeader(column);

  return (
    /^(mobile|mobile no|mobile number)(\s*\d+)?$/.test(header) ||
    /^(phone|phone no|phone number)(\s*\d+)?$/.test(header) ||
    /^(contact no|contact number)(\s*\d+)?$/.test(header)
  );
};

const isEmailColumn = (column) => {
  const header = normalizeContactHeader(column);

  return /^(email|email id|email address)(\s*\d+)?$/.test(header);
};

const isOtherColumn = (column) =>
  ['other', 'others'].includes(normalizeContactHeader(column));

const splitContactValue = (value) =>
  String(value || '')
    .split(/[\n,;|/]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const getGroupedContactValues = (row, indexes) => [
  ...new Set(
    indexes.flatMap((index) => splitContactValue(row[index])),
  ),
];

const getRowLog = (rowLogs = [], rowIndex) =>
  rowLogs.find(
    (rowLog) =>
      Number(rowLog.rowIndex) === Number(rowIndex),
  );

const addWorkColumnsAfterWebsite = (columns = [], rows = []) => {
  const safeColumns = columns.map(
    (column, index) =>
      String(column || '').trim() || `Column ${index + 1}`,
  );

  const workIndexes = new Map(
    CLIENT_WORK_COLUMNS.map((column) => [
      column,
      safeColumns.findIndex(
        (item) =>
          normalizeColumnName(item) === column.toLowerCase(),
      ),
    ]),
  );

  const dataIndexes = safeColumns
    .map((_, index) => index)
    .filter(
      (index) =>
        !CLIENT_WORK_COLUMNS.some(
          (column) =>
            normalizeColumnName(safeColumns[index]) ===
            column.toLowerCase(),
        ),
    );

  return {
    columns: [
      ...dataIndexes.map((index) => safeColumns[index]),
      ...CLIENT_WORK_COLUMNS,
    ],

    rows: rows.map((row) => [
      ...dataIndexes.map((index) => row[index] ?? ''),

      ...CLIENT_WORK_COLUMNS.map((column) =>
        workIndexes.get(column) === -1
          ? ''
          : (row[workIndexes.get(column)] ?? ''),
      ),
    ]),
  };
};

const ContactCell = ({ values, type }) => {
  if (!values.length) {
    return (
      <span className="text-xs font-medium text-slate-400">
        —
      </span>
    );
  }

  if (values.length === 1) {
    return (
      <span className="whitespace-nowrap text-sm font-medium text-slate-700">
        {values[0]}
      </span>
    );
  }

  return (
    <div className="min-w-44">
      <select
        defaultValue={values[0]}
        aria-label={`${type} options`}
        className="h-9 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        {values.map((value, index) => (
          <option
            key={`${value}-${index}`}
            value={value}
          >
            {value}
          </option>
        ))}
      </select>

      <p className="mt-1 text-[10px] font-semibold text-slate-400">
        {values.length} options
      </p>
    </div>
  );
};

const MessageIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4 fill-none stroke-current"
    strokeWidth="2"
  >
    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
    <path d="M8 9h8" />
    <path d="M8 13h5" />
  </svg>
);

const CloseIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4 fill-none stroke-current"
    strokeWidth="2"
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const CheckIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4 fill-none stroke-current"
    strokeWidth="2"
  >
    <path d="m5 12 4 4L19 6" />
  </svg>
);

const CalendarIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4 fill-none stroke-current"
    strokeWidth="2"
  >
    <path d="M8 2v4M16 2v4M3 10h18" />
    <path d="M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z" />
  </svg>
);

const formatMeetingDateTime = (meeting) => {
  if (!meeting?.meetingDate) {
    return 'Date not set';
  }

  const dateTime = new Date(
    `${meeting.meetingDate}T${meeting.meetingTime || '00:00'}:00`,
  );

  if (Number.isNaN(dateTime.getTime())) {
    return [meeting.meetingDate, meeting.meetingTime]
      .filter(Boolean)
      .join(' ');
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateTime);
};

const ClientDatasetDetail = () => {
  const { datasetId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [dataset, setDataset] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [employees, setEmployees] = useState([]);
  const [salesActions, setSalesActions] = useState([]);
  const [meetingActions, setMeetingActions] = useState([]);

  const [selectedRows, setSelectedRows] = useState([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] =
    useState([]);

  const [assignmentMode, setAssignmentMode] = useState('full');
  const [recordLimit, setRecordLimit] = useState('');

  const [assignmentMessage, setAssignmentMessage] =
    useState('');

  const [assignmentError, setAssignmentError] =
    useState('');

  const [isAssigning, setIsAssigning] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');

  const [assignmentFilter, setAssignmentFilter] =
    useState('all');

  const [sourceFilter, setSourceFilter] = useState('all');

  const [followUpDateFilter, setFollowUpDateFilter] =
    useState('');

  const [followUpDates, setFollowUpDates] = useState({});

  const [savingRows, setSavingRows] = useState({});
  const [saveError, setSaveError] = useState('');

  const [actionMessage, setActionMessage] = useState('');
  const [actionModal, setActionModal] = useState(null);
  const [actionSaved, setActionSaved] = useState(false);

  useEffect(() => {
    const fetchDataset = async () => {
      try {
        const token = getAuthToken();

        if (!token) {
          setError(
            'Session expired. Please login again.',
          );
          return;
        }

        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [datasetResponse, optionsResponse] =
          await Promise.all([
            axios.get(
              `${API_BASE_URL}/api/client-datasets/${datasetId}`,
              {
                headers,
              },
            ),

            axios
              .get(
                `${API_BASE_URL}/api/client-datasets/options`,
                {
                  headers,
                },
              )
              .catch(() => ({
                data: {},
              })),
          ]);

        setDataset(datasetResponse.data);

        setFollowUpDates(
          datasetResponse.data.followUpDates || {},
        );

        setEmployees(
          optionsResponse.data.employees || [],
        );

        setSalesActions(
          optionsResponse.data.actions || [],
        );

        setMeetingActions(
          optionsResponse.data.meetingActions || [],
        );
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            'Unable to load client data',
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchDataset();
  }, [datasetId]);

  const tableData = useMemo(() => {
    if (!dataset) {
      return {
        columns: [],
        rows: [],
      };
    }

    return addWorkColumnsAfterWebsite(
      dataset.columns || [],
      dataset.rows || [],
    );
  }, [dataset]);

  const statusIndex = getColumnIndex(
    tableData.columns,
    'Status',
  );

  const remarkIndex = getColumnIndex(
    tableData.columns,
    'Remark',
  );

  const employeeIndex = getColumnIndex(
    tableData.columns,
    'Employee',
  );

  const sourceIndex = getColumnIndex(
    tableData.columns,
    'Source',
  );

  const phoneColumnIndexes = useMemo(
    () =>
      tableData.columns
        .map((column, index) =>
          isPhoneColumn(column) ? index : -1,
        )
        .filter((index) => index !== -1),
    [tableData.columns],
  );

  const emailColumnIndexes = useMemo(
    () =>
      tableData.columns
        .map((column, index) =>
          isEmailColumn(column) ? index : -1,
        )
        .filter((index) => index !== -1),
    [tableData.columns],
  );

  const primaryPhoneIndex =
    phoneColumnIndexes[0] ?? -1;

  const primaryEmailIndex =
    emailColumnIndexes[0] ?? -1;

  const displayColumnIndexes = useMemo(() => {
    const hiddenIndexes = new Set([
      statusIndex,
      remarkIndex,

      ...phoneColumnIndexes.slice(1),
      ...emailColumnIndexes.slice(1),

      ...tableData.columns
        .map((column, index) =>
          isOtherColumn(column) ? index : -1,
        )
        .filter((index) => index !== -1),
    ]);

    return tableData.columns
      .map((_, index) => index)
      .filter((index) => !hiddenIndexes.has(index));
  }, [
    tableData.columns,
    statusIndex,
    remarkIndex,
    phoneColumnIndexes,
    emailColumnIndexes,
  ]);

  if (isLoading) {
    return (
      <div className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white" />
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">
        {error}
      </div>
    );
  }

  if (!dataset) {
    return null;
  }

  const isAdmin = salesActions.includes('assign');
  const canUpdate = salesActions.includes('update');
  const canViewMeetings = meetingActions.includes('view');
  const canScheduleMeeting = meetingActions.includes('create');

  const inEmployeeSales =
    location.pathname.startsWith(
      '/employee-dashboard/sales',
    );

  const backLink =
    getAuthenticatedRole() === 'admin'
      ? '/dashboard/clients'
      : inEmployeeSales
        ? '/employee-dashboard/sales'
        : '/employee-dashboard/datasets';

  const backLabel =
    inEmployeeSales ||
    getAuthenticatedRole() === 'admin'
      ? 'Back to sales data'
      : 'Back to assigned datasets';

  const getOriginalRowIndex = (rowIndex) =>
    dataset.originalRowIndexes?.[rowIndex] ??
    rowIndex;

  const getRowMeetings = (rowIndex) => {
    const originalRowIndex = getOriginalRowIndex(rowIndex);
    const value =
      dataset.rowMeetings?.[String(originalRowIndex)] ??
      dataset.rowMeetings?.[originalRowIndex];

    if (!value) {
      return [];
    }

    return (Array.isArray(value) ? value : [value]).filter(Boolean);
  };

  const getPrimaryMeeting = (rowMeetings) => {
    const sortedMeetings = [...rowMeetings].sort((first, second) =>
      `${first.meetingDate || '9999-12-31'}T${first.meetingTime || '23:59'}`.localeCompare(
        `${second.meetingDate || '9999-12-31'}T${second.meetingTime || '23:59'}`,
      ),
    );
    const today = getTodayDateKey();

    return (
      sortedMeetings.find(
        (meeting) =>
          String(meeting.status || 'scheduled').toLowerCase() === 'scheduled' &&
          meeting.meetingDate >= today,
      ) ||
      sortedMeetings.find(
        (meeting) =>
          String(meeting.status || 'scheduled').toLowerCase() === 'scheduled',
      ) ||
      sortedMeetings[0] ||
      null
    );
  };

  const getScheduleMeetingUrl = (rowIndex) => {
    const query = new URLSearchParams({
      create: '1',
      datasetId: String(datasetId),
      rowIndex: String(getOriginalRowIndex(rowIndex)),
    });

    return `/dashboard/meetings?${query.toString()}`;
  };

  const scheduleMeetingForRow = (rowIndex) => {
    navigate(getScheduleMeetingUrl(rowIndex));
  };

  const assignmentMap = new Map();

  (dataset.rowAssignments || []).forEach(
    (assignment) => {
      const originalIndex = Number(
        assignment.rowIndex,
      );

      assignmentMap.set(originalIndex, [
        ...(assignmentMap.get(originalIndex) || []),
        assignment,
      ]);
    },
  );

  const eligibleEmployees = employees.filter(
    (employee) =>
      !dataset.businessUnitId ||
      (employee.businessUnitIds || []).includes(
        String(dataset.businessUnitId),
      ),
  );

  const selectedEmployees =
    eligibleEmployees.filter((employee) =>
      selectedEmployeeIds.includes(employee._id),
    );

  const getFollowUpDate = (rowIndex) =>
    followUpDates[
      String(getOriginalRowIndex(rowIndex))
    ] || '';

  const todayDateKey = getTodayDateKey();

  const normalizedSearch = searchTerm
    .trim()
    .toLowerCase();

  const sourceOptions =
    sourceIndex === -1
      ? []
      : [
          ...new Set(
            tableData.rows
              .map((row) =>
                String(
                  row[sourceIndex] || '',
                ).trim(),
              )
              .filter(Boolean),
          ),
        ].sort((first, second) =>
          first.localeCompare(second),
        );

  const statusCounts = tableData.rows.reduce(
    (counts, row) => {
      const status = row[statusIndex] || '';

      counts.all += 1;

      if (status) {
        counts[status] =
          (counts[status] || 0) + 1;
      }

      return counts;
    },
    {
      all: 0,
    },
  );

  const selectedFilterEmployee =
    employeeFilter === 'all'
      ? null
      : eligibleEmployees.find(
          (employee) =>
            String(employee._id) ===
            String(employeeFilter),
        );

  const rowMatchesEmployee = (row, rowIndex) => {
    if (!selectedFilterEmployee) {
      return true;
    }

    const originalIndex =
      getOriginalRowIndex(rowIndex);

    const assignments =
      assignmentMap.get(originalIndex) || [];

    const assignedCell =
      employeeIndex === -1
        ? ''
        : String(
            row[employeeIndex] || '',
          ).trim();

    const selectedName = String(
      selectedFilterEmployee.name ||
        selectedFilterEmployee.email ||
        '',
    ).trim();

    return (
      assignments.some((assignment) => {
        const assignmentId =
          assignment.employee?._id ||
          assignment.employee ||
          assignment.employeeId ||
          assignment.assignedTo?._id;

        const assignmentName = String(
          assignment.employeeName ||
            assignment.employee?.name ||
            assignment.assignedTo?.name ||
            '',
        ).trim();

        return (
          (assignmentId &&
            String(assignmentId) ===
              String(
                selectedFilterEmployee._id,
              )) ||
          (selectedName &&
            assignmentName === selectedName)
        );
      }) ||
      (selectedName &&
        assignedCell.includes(selectedName))
    );
  };

  const visibleRows = tableData.rows
    .map((row, rowIndex) => ({
      row,
      rowIndex,
    }))
    .filter(({ row, rowIndex }) => {
      const status = row[statusIndex] || '';

      const followUpDate =
        getFollowUpDate(rowIndex);

      const originalIndex =
        getOriginalRowIndex(rowIndex);

      const assignments =
        assignmentMap.get(originalIndex) || [];

      const assignedCell =
        employeeIndex === -1
          ? ''
          : String(
              row[employeeIndex] || '',
            ).trim();

      const isAssigned =
        assignments.length > 0 ||
        Boolean(assignedCell);

      const matchesSearch =
        !normalizedSearch ||
        row.some((cell) =>
          String(cell || '')
            .toLowerCase()
            .includes(normalizedSearch),
        );

      const matchesStatus =
        statusFilter === 'all' ||
        status === statusFilter;

      const matchesEmployee =
        rowMatchesEmployee(row, rowIndex);

      const matchesAssignment =
        assignmentFilter === 'all' ||
        (assignmentFilter === 'assigned' &&
          isAssigned) ||
        (assignmentFilter === 'unassigned' &&
          !isAssigned);

      const matchesSource =
        sourceFilter === 'all' ||
        (sourceIndex !== -1 &&
          String(
            row[sourceIndex] || '',
          ).trim() === sourceFilter);

      const matchesFollowUpDate =
        statusFilter !== 'Follow Up'
          ? true
          : followUpDateFilter
            ? followUpDate === followUpDateFilter
            : !followUpDate ||
              followUpDate >= todayDateKey;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesEmployee &&
        matchesAssignment &&
        matchesSource &&
        matchesFollowUpDate
      );
    })
    .sort((first, second) => {
      if (statusFilter !== 'Follow Up') {
        return first.rowIndex - second.rowIndex;
      }

      const firstDate =
        getFollowUpDate(first.rowIndex) ||
        '9999-12-31';

      const secondDate =
        getFollowUpDate(second.rowIndex) ||
        '9999-12-31';

      return (
        firstDate.localeCompare(secondDate) ||
        first.rowIndex -
          second.rowIndex
      );
    });

  const hasActiveFilters =
    Boolean(searchTerm.trim()) ||
    statusFilter !== 'all' ||
    employeeFilter !== 'all' ||
    assignmentFilter !== 'all' ||
    sourceFilter !== 'all' ||
    Boolean(followUpDateFilter);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setEmployeeFilter('all');
    setAssignmentFilter('all');
    setSourceFilter('all');
    setFollowUpDateFilter('');
  };

  const toggleRowSelection = (rowIndex) => {
    setSelectedRows((previous) =>
      previous.includes(rowIndex)
        ? previous.filter(
            (selectedRow) =>
              selectedRow !== rowIndex,
          )
        : [...previous, rowIndex],
    );
  };

  const selectUnassignedRows = () => {
    const nextSelectedRows =
      tableData.rows
        .map((_, rowIndex) => rowIndex)
        .filter((rowIndex) => {
          const originalIndex =
            getOriginalRowIndex(rowIndex);

          return !(
            assignmentMap.get(originalIndex) || []
          ).length;
        });

    setSelectedRows(nextSelectedRows);
  };

  const updateAssignmentState = (
    responseData,
  ) => {
    setDataset((previous) => ({
      ...previous,
      columns: responseData.columns,
      rows: responseData.rows,
      rowAssignments:
        responseData.rowAssignments,
    }));

    setSelectedRows([]);
  };

  const refreshDataset = async () => {
    const token = getAuthToken();

    if (!token) {
      throw new Error(
        'Session expired. Please login again.',
      );
    }

    const response = await axios.get(
      `${API_BASE_URL}/api/client-datasets/${datasetId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    setDataset(response.data);

    setFollowUpDates(
      response.data.followUpDates || {},
    );

    return response.data;
  };

  const handleAssignRows = async () => {
    setAssignmentMessage('');
    setAssignmentError('');

    if (
      assignmentMode === 'selected' &&
      selectedRows.length === 0
    ) {
      setAssignmentError(
        'Select at least one row',
      );
      return;
    }

    if (!selectedEmployeeIds.length) {
      setAssignmentError(
        'Select at least one employee',
      );
      return;
    }

    const token = getAuthToken();

    if (!token) {
      setAssignmentError(
        'Session expired. Please login again.',
      );
      return;
    }

    setIsAssigning(true);

    try {
      const response = await axios.patch(
        `${API_BASE_URL}/api/client-datasets/${datasetId}/assign`,
        {
          rowIndexes: selectedRows.map(
            getOriginalRowIndex,
          ),

          employeeIds: selectedEmployeeIds,

          assignmentMode,

          limit:
            assignmentMode === 'limited'
              ? Number(recordLimit)
              : undefined,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      updateAssignmentState(response.data);

      setAssignmentMessage(
        response.data.message ||
          'Data assigned successfully',
      );
    } catch (requestError) {
      setAssignmentError(
        requestError.response?.data?.message ||
          'Unable to assign selected rows',
      );
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassignRows = async () => {
    setAssignmentMessage('');
    setAssignmentError('');

    if (!selectedRows.length) {
      setAssignmentError(
        'Select at least one row',
      );
      return;
    }

    const token = getAuthToken();

    if (!token) {
      setAssignmentError(
        'Session expired. Please login again.',
      );
      return;
    }

    setIsAssigning(true);

    try {
      const response = await axios.patch(
        `${API_BASE_URL}/api/client-datasets/${datasetId}/unassign`,
        {
          rowIndexes: selectedRows.map(
            getOriginalRowIndex,
          ),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      updateAssignmentState(response.data);

      // Refresh from backend after unassign.
      await refreshDataset();

      setSelectedRows([]);

      setAssignmentMessage(
        response.data.message ||
          'Rows unassigned successfully',
      );
    } catch (requestError) {
      setAssignmentError(
        requestError.response?.data?.message ||
          'Unable to unassign selected rows',
      );
    } finally {
      setIsAssigning(false);
    }
  };

  const openActionModal = (rowIndex, row) => {
    setSaveError('');
    setActionMessage('');
    setActionSaved(false);

    setActionModal({
      rowIndex,

      status: row[statusIndex] || '',

      remark: row[remarkIndex] || '',

      followUpDate:
        getFollowUpDate(rowIndex),
    });
  };

  const closeActionModal = () => {
    setActionModal(null);
    setSaveError('');
    setActionMessage('');
    setActionSaved(false);
  };

  const saveActionChanges = async (
    { scheduleAfterSave = false } = {},
  ) => {
    if (!actionModal || !canUpdate) {
      return;
    }

    const token = getAuthToken();

    if (!token) {
      setSaveError(
        'Session expired. Please login again.',
      );
      return;
    }

    const rowIndex = actionModal.rowIndex;

    const originalRowIndex =
      getOriginalRowIndex(rowIndex);

    setSaveError('');
    setActionMessage('');

    setSavingRows((previous) => ({
      ...previous,
      [rowIndex]: true,
    }));

    try {
      const response = await axios.patch(
        `${API_BASE_URL}/api/client-datasets/${datasetId}/rows/${originalRowIndex}/status`,
        {
          status: actionModal.status || '',

          remark: actionModal.remark || '',

          followUpDate:
            actionModal.status === 'Follow Up'
              ? actionModal.followUpDate || ''
              : '',
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      setDataset((previous) => {
        const normalized =
          addWorkColumnsAfterWebsite(
            previous.columns,
            previous.rows,
          );

        const nextRows = normalized.rows.map(
          (row, currentRowIndex) =>
            getOriginalRowIndex(currentRowIndex) ===
            Number(response.data.rowIndex)
              ? response.data.row
              : row,
        );

        const nextRowLogs =
          response.data.rowLog
            ? [
                ...(previous.rowLogs || []).filter(
                  (rowLog) =>
                    Number(rowLog.rowIndex) !==
                    Number(
                      response.data.rowIndex,
                    ),
                ),

                response.data.rowLog,
              ]
            : previous.rowLogs;

        return {
          ...previous,

          columns:
            response.data.columns ||
            normalized.columns,

          rows: nextRows,

          rowLogs: nextRowLogs,
        };
      });

      if (response.data.followUpDates) {
        setFollowUpDates(
          response.data.followUpDates,
        );
      } else {
        setFollowUpDates((previous) => {
          const next = {
            ...previous,
          };

          const key =
            String(originalRowIndex);

          const nextDate =
            response.data.followUpDate || '';

          if (nextDate) {
            next[key] = nextDate;
          } else {
            delete next[key];
          }

          return next;
        });
      }

      if (scheduleAfterSave) {
        navigate(getScheduleMeetingUrl(rowIndex));
        return;
      }

      setActionMessage(
        'Your action saved successfully.',
      );

      setActionSaved(true);

      window.setTimeout(() => {
        setActionModal(null);
        setActionSaved(false);
        setActionMessage('');
        setSaveError('');
      }, 900);
    } catch (requestError) {
      setSaveError(
        requestError.response?.data?.message ||
          'Unable to save client action. Please try again.',
      );
    } finally {
      setSavingRows((previous) => ({
        ...previous,
        [rowIndex]: false,
      }));
    }
  };

  const currentActionRowLog =
    actionModal
      ? getRowLog(
          dataset.rowLogs || [],
          getOriginalRowIndex(
            actionModal.rowIndex,
          ),
        )
      : null;

  const currentActionEntries = [
    ...(currentActionRowLog?.entries || []),
  ].reverse();

  return (
    <div className="w-full space-y-5">
      <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            to={backLink}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800"
          >
            ← {backLabel}
          </Link>

          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            {dataset.name}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {dataset.year || 'No year'} · Uploaded{' '}
            {formatDate(dataset.createdAt)} ·{' '}
            {dataset.rowCount} rows
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">
            {dataset.businessUnitName ||
              dataset.tableFormat ||
              'Sales Data'}
          </span>

          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600">
            {dataset.originalFileName}
          </span>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
        <div className="border-b border-slate-300 bg-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">
            Client data table
          </h2>

          <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <input
                type="search"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
                placeholder="Search client, phone, email, city, source..."
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 xl:max-w-sm"
              />

              <div className="grid flex-1 grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    const value =
                      event.target.value;

                    setStatusFilter(value);

                    if (value !== 'Follow Up') {
                      setFollowUpDateFilter('');
                    }
                  }}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="all">
                    All statuses
                  </option>

                  {CLIENT_STATUS_OPTIONS.map(
                    (status) => (
                      <option
                        key={status}
                        value={status}
                      >
                        {status}
                      </option>
                    ),
                  )}
                </select>

                <select
                  value={employeeFilter}
                  onChange={(event) =>
                    setEmployeeFilter(
                      event.target.value,
                    )
                  }
                  className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="all">
                    All employees
                  </option>

                  {eligibleEmployees.map(
                    (employee) => (
                      <option
                        key={employee._id}
                        value={String(
                          employee._id,
                        )}
                      >
                        {employee.name ||
                          employee.email}
                      </option>
                    ),
                  )}
                </select>

                <select
                  value={assignmentFilter}
                  onChange={(event) =>
                    setAssignmentFilter(
                      event.target.value,
                    )
                  }
                  className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="all">
                    All assignments
                  </option>

                  <option value="assigned">
                    Assigned
                  </option>

                  <option value="unassigned">
                    Unassigned
                  </option>
                </select>

                {sourceIndex !== -1 ? (
                  <select
                    value={sourceFilter}
                    onChange={(event) =>
                      setSourceFilter(
                        event.target.value,
                      )
                    }
                    className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none"
                  >
                    <option value="all">
                      All sources
                    </option>

                    {sourceOptions.map(
                      (source) => (
                        <option
                          key={source}
                          value={source}
                        >
                          {source}
                        </option>
                      ),
                    )}
                  </select>
                ) : (
                  <div className="hidden xl:block" />
                )}
              </div>
            </div>

            {statusFilter === 'Follow Up' && (
              <div className="flex flex-wrap items-end gap-2 rounded-lg border border-violet-200 bg-violet-50/70 p-3">
                <label>
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-violet-700">
                    Follow-up date
                  </span>

                  <input
                    type="date"
                    min={todayDateKey}
                    value={followUpDateFilter}
                    onChange={(event) =>
                      setFollowUpDateFilter(
                        event.target.value,
                      )
                    }
                    className="h-9 rounded-lg border border-violet-300 bg-white px-3 text-xs font-semibold text-violet-800 outline-none"
                  />
                </label>

                <p className="pb-2 text-xs font-medium text-violet-700">
                  Today first, then upcoming
                  follow-ups.
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span>
                  {visibleRows.length}{' '}
                  visible client
                  {visibleRows.length === 1
                    ? ''
                    : 's'}
                </span>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="font-bold text-blue-700 hover:underline"
                  >
                    Reset filters
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  [
                    'all',
                    'All',
                    statusCounts.all || 0,
                  ],

                  [
                    'Pending',
                    'Pending',
                    statusCounts.Pending || 0,
                  ],

                  [
                    'Contacted',
                    'Contacted',
                    statusCounts.Contacted || 0,
                  ],

                  [
                    'Follow Up',
                    'Follow-up',
                    statusCounts['Follow Up'] || 0,
                  ],

                  [
                    'Interested',
                    'Interested',
                    statusCounts.Interested || 0,
                  ],

                  [
                    'Converted',
                    'Converted',
                    statusCounts.Converted || 0,
                  ],
                ].map(
                  ([value, label, count]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setStatusFilter(value);

                        if (
                          value !== 'Follow Up'
                        ) {
                          setFollowUpDateFilter('');
                        }
                      }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                        statusFilter === value
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-blue-50'
                      }`}
                    >
                      {label}{' '}

                      <span className="ml-1 opacity-80">
                        {count}
                      </span>
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
              <div className="grid gap-3 lg:grid-cols-[auto_minmax(10rem,0.7fr)_minmax(16rem,1.2fr)_auto] lg:items-end">
                <div>
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Row selection
                  </span>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectUnassignedRows}
                      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-blue-50"
                    >
                      Select free rows
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedRows([])
                      }
                      disabled={!selectedRows.length}
                      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 disabled:opacity-40"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <label>
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Distribution
                  </span>

                  <select
                    value={assignmentMode}
                    onChange={(event) =>
                      setAssignmentMode(
                        event.target.value,
                      )
                    }
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="full">
                      Full data (
                      {tableData.rows.length})
                    </option>

                    <option value="half">
                      Half data (
                      {Math.ceil(
                        tableData.rows.length / 2,
                      )}
                      )
                    </option>

                    <option value="limited">
                      Limited records
                    </option>

                    <option value="selected">
                      Selected rows (
                      {selectedRows.length})
                    </option>
                  </select>
                </label>

                <div className="relative">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Assign employees
                  </span>

                  <details className="group relative">
                    <summary className="flex h-10 cursor-pointer list-none items-center justify-between rounded-lg border border-slate-300 bg-white px-3 text-sm">
                      <span>
                        {selectedEmployees.length
                          ? `${selectedEmployees.length} selected`
                          : 'Select employees'}
                      </span>

                      <span>⌄</span>
                    </summary>

                    <div className="absolute right-0 z-40 mt-2 w-full min-w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                      <div className="max-h-60 space-y-1 overflow-y-auto">
                        {eligibleEmployees.map(
                          (employee) => {
                            const checked =
                              selectedEmployeeIds.includes(
                                employee._id,
                              );

                            return (
                              <label
                                key={employee._id}
                                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setSelectedEmployeeIds(
                                      (previous) =>
                                        checked
                                          ? previous.filter(
                                              (id) =>
                                                id !==
                                                employee._id,
                                            )
                                          : [
                                              ...previous,
                                              employee._id,
                                            ],
                                    )
                                  }
                                />

                                <span className="text-sm font-semibold text-slate-800">
                                  {employee.name ||
                                    employee.email}
                                </span>
                              </label>
                            );
                          },
                        )}
                      </div>
                    </div>
                  </details>
                </div>

                <div className="flex items-end gap-2">
                  {assignmentMode === 'limited' && (
                    <input
                      type="number"
                      min="1"
                      max={tableData.rows.length}
                      value={recordLimit}
                      onChange={(event) =>
                        setRecordLimit(
                          event.target.value,
                        )
                      }
                      placeholder="Qty"
                      className="h-10 w-24 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                    />
                  )}

                  <button
                    type="button"
                    onClick={handleAssignRows}
                    disabled={
                      isAssigning ||
                      !selectedEmployeeIds.length
                    }
                    className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:bg-slate-300"
                  >
                    {isAssigning
                      ? 'Working...'
                      : 'Assign'}
                  </button>

                  <button
                    type="button"
                    onClick={handleUnassignRows}
                    disabled={
                      isAssigning ||
                      !selectedRows.length
                    }
                    className="h-10 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-600 disabled:opacity-40"
                  >
                    Unassign
                  </button>
                </div>
              </div>

              {assignmentMessage && (
                <p className="mt-2 text-xs font-semibold text-emerald-600">
                  {assignmentMessage}
                </p>
              )}

              {assignmentError && (
                <p className="mt-2 text-xs font-semibold text-red-600">
                  {assignmentError}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-100">
                {isAdmin && (
                  <th className="whitespace-nowrap border border-slate-300 px-3 py-2 text-center font-semibold text-slate-800">
                    Select
                  </th>
                )}

                <th className="whitespace-nowrap border border-slate-300 px-3 py-2 text-center font-semibold text-slate-800">
                  S.No.
                </th>

                {displayColumnIndexes.map(
                  (columnIndex) => {
                    const column =
                      tableData.columns[
                        columnIndex
                      ];

                    const normalizedColumn =
                      normalizeColumnName(column);

                    const label =
                      columnIndex ===
                      primaryPhoneIndex
                        ? 'Mobile'
                        : columnIndex ===
                            primaryEmailIndex
                          ? 'Email'
                          : normalizedColumn ===
                              'employee'
                            ? 'Assigned To'
                            : column;

                    return (
                      <th
                        key={`${column}-${columnIndex}`}
                        className="whitespace-nowrap border border-slate-300 px-3 py-2 font-semibold text-slate-800"
                      >
                        {label}
                      </th>
                    );
                  },
                )}

                <th className="whitespace-nowrap border border-slate-300 px-3 py-2 text-center font-semibold text-slate-800">
                  Meeting
                </th>

                <th className="whitespace-nowrap border border-slate-300 px-3 py-2 text-center font-semibold text-slate-800">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {visibleRows.map(
                (
                  { row, rowIndex },
                  visibleIndex,
                ) => {
                  const rowStatus =
                    row[statusIndex] || '';

                  const rowClass =
                    STATUS_ROW_STYLES[
                      rowStatus
                    ] ||
                    (visibleIndex % 2 === 0
                      ? 'bg-white'
                      : 'bg-slate-50');

                  const rowMeetings =
                    getRowMeetings(rowIndex);

                  const primaryMeeting =
                    getPrimaryMeeting(rowMeetings);

                  const hasUpcomingScheduledMeeting =
                    rowMeetings.some(
                      (meeting) =>
                        String(
                          meeting.status ||
                            'scheduled',
                        ).toLowerCase() ===
                          'scheduled' &&
                        meeting.meetingDate >=
                          todayDateKey,
                    );

                  const primaryMeetingId =
                    primaryMeeting?._id ||
                    primaryMeeting?.meetingId;

                  const primaryMeetingStatus =
                    String(
                      primaryMeeting?.status ||
                        'scheduled',
                    ).toLowerCase();

                  const meetingStatusClass =
                    primaryMeetingStatus ===
                    'cancelled'
                      ? 'bg-rose-50 text-rose-700'
                      : primaryMeetingStatus ===
                          'completed'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-blue-50 text-blue-700';

                  const meetingSummary =
                    primaryMeeting ? (
                      <>
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meetingStatusClass}`}
                        >
                          <CalendarIcon />
                        </span>

                        <span className="min-w-0 text-left">
                          <span className="block whitespace-nowrap text-xs font-bold text-slate-800">
                            {formatMeetingDateTime(
                              primaryMeeting,
                            )}
                          </span>

                          <span className="mt-0.5 block max-w-44 truncate text-[11px] font-medium text-slate-500">
                            {primaryMeeting.meetingTitle ||
                              primaryMeetingStatus}
                          </span>
                        </span>
                      </>
                    ) : null;

                  return (
                    <tr
                      key={rowIndex}
                      className={`${rowClass} transition hover:brightness-[0.99]`}
                    >
                      {isAdmin && (
                        <td className="border border-slate-300 px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={selectedRows.includes(
                              rowIndex,
                            )}
                            onChange={() =>
                              toggleRowSelection(
                                rowIndex,
                              )
                            }
                            className="h-4 w-4 cursor-pointer rounded border-slate-300"
                          />
                        </td>
                      )}

                      <td className="whitespace-nowrap border border-slate-300 px-3 py-2 text-center text-xs font-semibold text-slate-500">
                        {getOriginalRowIndex(
                          rowIndex,
                        ) + 1}
                      </td>

                      {displayColumnIndexes.map(
                        (columnIndex) => {
                          const column =
                            tableData.columns[
                              columnIndex
                            ];

                          const normalizedColumn =
                            normalizeColumnName(
                              column,
                            );

                          if (
                            columnIndex ===
                            primaryPhoneIndex
                          ) {
                            return (
                              <td
                                key={`${rowIndex}-mobile`}
                                className="border border-slate-300 px-3 py-2"
                              >
                                <ContactCell
                                  values={getGroupedContactValues(
                                    row,
                                    phoneColumnIndexes,
                                  )}
                                  type="Mobile"
                                />
                              </td>
                            );
                          }

                          if (
                            columnIndex ===
                            primaryEmailIndex
                          ) {
                            return (
                              <td
                                key={`${rowIndex}-email`}
                                className="border border-slate-300 px-3 py-2"
                              >
                                <ContactCell
                                  values={getGroupedContactValues(
                                    row,
                                    emailColumnIndexes,
                                  )}
                                  type="Email"
                                />
                              </td>
                            );
                          }

                          if (
                            normalizedColumn ===
                            'employee'
                          ) {
                            const originalIndex =
                              getOriginalRowIndex(
                                rowIndex,
                              );

                            const assignments =
                              assignmentMap.get(
                                originalIndex,
                              ) || [];

                            const employeeNames =
                              assignments
                                .map(
                                  (assignment) =>
                                    assignment.employeeName,
                                )
                                .filter(Boolean);

                            if (
                              !employeeNames.length &&
                              row[columnIndex]
                            ) {
                              employeeNames.push(
                                row[columnIndex],
                              );
                            }

                            return (
                              <td
                                key={`${rowIndex}-${column}-${columnIndex}`}
                                className="border border-slate-300 px-3 py-2"
                              >
                                {employeeNames.length ? (
                                  <div className="flex min-w-44 flex-wrap gap-1.5">
                                    {employeeNames.map(
                                      (
                                        employeeName,
                                      ) => (
                                        <span
                                          key={
                                            employeeName
                                          }
                                          className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                                        >
                                          {
                                            employeeName
                                          }
                                        </span>
                                      ),
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs font-medium text-slate-400">
                                    Unassigned
                                  </span>
                                )}
                              </td>
                            );
                          }

                          return (
                            <td
                              key={`${rowIndex}-${column}-${columnIndex}`}
                              className="whitespace-nowrap border border-slate-300 px-3 py-2 text-slate-700"
                            >
                              {row[columnIndex] || ''}
                            </td>
                          );
                        },
                      )}

                      <td className="min-w-56 border border-slate-300 px-3 py-2">
                        {primaryMeeting ? (
                          <div className="flex items-center gap-2">
                            {primaryMeetingId && canViewMeetings ? (
                              <Link
                                to={`/dashboard/meetings?meetingId=${encodeURIComponent(primaryMeetingId)}`}
                                title="Open meeting"
                                className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 shadow-sm transition hover:border-blue-300 hover:bg-blue-50/60"
                              >
                                {meetingSummary}
                              </Link>
                            ) : (
                              <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                                {meetingSummary}
                              </div>
                            )}

                            {rowMeetings.length > 1 && (
                              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                                +{rowMeetings.length - 1}
                              </span>
                            )}

                            {rowStatus ===
                              'Interested' &&
                              canScheduleMeeting &&
                              !hasUpcomingScheduledMeeting && (
                                <button
                                  type="button"
                                  title="Schedule another meeting"
                                  onClick={() =>
                                    scheduleMeetingForRow(
                                      rowIndex,
                                    )
                                  }
                                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-cyan-300 bg-cyan-50 px-2 text-[11px] font-bold text-cyan-800 transition hover:border-cyan-400 hover:bg-cyan-100"
                                >
                                  <CalendarIcon />
                                  New
                                </button>
                              )}
                          </div>
                        ) : rowStatus ===
                            'Interested' &&
                          canScheduleMeeting ? (
                          <button
                            type="button"
                            onClick={() =>
                              scheduleMeetingForRow(
                                rowIndex,
                              )
                            }
                            className="inline-flex items-center gap-2 rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-800 transition hover:border-cyan-400 hover:bg-cyan-100"
                          >
                            <CalendarIcon />
                            Schedule meeting
                          </button>
                        ) : (
                          <span className="block text-center text-xs font-medium text-slate-400">
                            —
                          </span>
                        )}
                      </td>

                      <td className="border border-slate-300 px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            openActionModal(
                              rowIndex,
                              row,
                            )
                          }
                          title="Open actions"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <MessageIcon />
                        </button>
                      </td>
                    </tr>
                  );
                },
              )}

              {!visibleRows.length && (
                <tr>
                  <td
                    colSpan={
                      displayColumnIndexes.length +
                      3 +
                      (isAdmin ? 1 : 0)
                    }
                    className="border border-slate-300 px-3 py-10 text-center text-slate-500"
                  >
                    {tableData.rows.length
                      ? 'No clients match the selected filters.'
                      : 'No rows found in this file.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  Client actions
                </p>

                <h3 className="text-lg font-semibold text-slate-950">
                  Status, remark & log
                </h3>
              </div>

              <button
                type="button"
                onClick={closeActionModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100"
              >
                <CloseIcon />
              </button>
            </div>

            {actionSaved ? (
              <div className="flex min-h-72 flex-col items-center justify-center px-6 py-10 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-10 w-10 fill-none stroke-current"
                    strokeWidth="2.5"
                  >
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                </div>

                <h3 className="mt-5 text-xl font-bold text-slate-950">
                  Your action saved successfully
                </h3>

                <p className="mt-2 text-sm font-medium text-slate-500">
                  Status and remark have been updated.
                </p>
              </div>
            ) : (
              <div className="max-h-[calc(90vh-74px)] overflow-y-auto p-5">
                <div className="space-y-5">
                  <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <label className="block">
                      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-600">
                        Status
                      </span>

                      <select
                        value={actionModal.status}
                        disabled={!canUpdate}
                        onChange={(event) => {
                          const nextStatus =
                            event.target.value;

                          setSaveError('');
                          setActionMessage('');

                          setActionModal(
                            (previous) => ({
                              ...previous,

                              status: nextStatus,

                              followUpDate:
                                nextStatus ===
                                'Follow Up'
                                  ? previous.followUpDate ||
                                    ''
                                  : '',
                            }),
                          );
                        }}
                        className={`h-10 w-full rounded-lg border px-3 text-sm font-bold outline-none transition focus:ring-2 focus:ring-blue-100 ${
                          STATUS_SELECT_STYLES[
                            actionModal.status
                          ] ||
                          STATUS_SELECT_STYLES['']
                        }`}
                      >
                        <option value="">
                          Select status
                        </option>

                        {CLIENT_STATUS_OPTIONS.map(
                          (status) => (
                            <option
                              key={status}
                              value={status}
                            >
                              {status}
                            </option>
                          ),
                        )}
                      </select>
                    </label>

                    {actionModal.status ===
                      'Follow Up' && (
                      <label className="mt-4 block">
                        <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-violet-700">
                          Follow-up date
                        </span>

                        <input
                          type="date"
                          min={todayDateKey}
                          value={
                            actionModal.followUpDate ||
                            ''
                          }
                          disabled={!canUpdate}
                          onChange={(event) => {
                            setSaveError('');
                            setActionMessage('');

                            setActionModal(
                              (previous) => ({
                                ...previous,

                                followUpDate:
                                  event.target
                                    .value,
                              }),
                            );
                          }}
                          className="h-10 w-full rounded-lg border border-violet-300 bg-violet-50 px-3 text-sm font-semibold text-violet-800 outline-none focus:ring-2 focus:ring-violet-100"
                        />
                      </label>
                    )}

                    <label className="mt-4 block">
                      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-600">
                        Remark
                      </span>

                      <textarea
                        rows="4"
                        value={actionModal.remark}
                        disabled={!canUpdate}
                        onChange={(event) => {
                          setSaveError('');
                          setActionMessage('');

                          setActionModal(
                            (previous) => ({
                              ...previous,

                              remark:
                                event.target.value,
                            }),
                          );
                        }}
                        placeholder="Write remark here..."
                        className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                      />
                    </label>

                    {saveError && (
                      <p className="mt-3 text-xs font-semibold text-red-600">
                        {saveError}
                      </p>
                    )}

                    {actionMessage && (
                      <p className="mt-3 text-xs font-semibold text-emerald-600">
                        {actionMessage}
                      </p>
                    )}

                    {canUpdate && (
                      <div className="mt-4 flex flex-wrap justify-end gap-2">
                        {actionModal.status ===
                          'Interested' &&
                          canScheduleMeeting && (
                            <button
                              type="button"
                              onClick={() =>
                                saveActionChanges({
                                  scheduleAfterSave:
                                    true,
                                })
                              }
                              disabled={
                                savingRows[
                                  actionModal
                                    .rowIndex
                                ]
                              }
                              className="inline-flex items-center gap-2 rounded-lg border border-cyan-300 bg-cyan-50 px-4 py-2.5 text-sm font-semibold text-cyan-800 transition hover:border-cyan-400 hover:bg-cyan-100 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              <CalendarIcon />

                              {savingRows[
                                actionModal.rowIndex
                              ]
                                ? 'Saving...'
                                : 'Save & schedule meeting'}
                            </button>
                          )}

                        <button
                          type="button"
                          onClick={() =>
                            saveActionChanges()
                          }
                          disabled={
                            savingRows[
                              actionModal.rowIndex
                            ]
                          }
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
                        >
                          <CheckIcon />

                          {savingRows[
                            actionModal.rowIndex
                          ]
                            ? 'Saving...'
                            : 'Save changes'}
                        </button>
                      </div>
                    )}
                  </section>

                  <section>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                          Activity log
                        </p>

                        <h4 className="mt-0.5 text-base font-semibold text-slate-950">
                          Client history
                        </h4>
                      </div>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {
                          currentActionEntries.length
                        }{' '}
                        entries
                      </span>
                    </div>

                    <div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">
                      {currentActionEntries.map(
                        (entry, index) => (
                          <div
                            key={`${entry.changedAt}-${index}`}
                            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                          >
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-slate-950">
                                  {entry.statusChanged &&
                                  entry.remarkChanged
                                    ? 'Status and remark updated'
                                    : entry.statusChanged
                                      ? 'Status updated'
                                      : 'Remark updated'}
                                </p>

                                <p className="mt-0.5 text-xs font-medium text-blue-700">
                                  Updated by{' '}
                                  {entry.changedByName ||
                                    entry.changedBy
                                      ?.name ||
                                    entry.changedBy
                                      ?.email ||
                                    'Unknown user'}
                                </p>
                              </div>

                              <p className="text-xs font-medium text-slate-500">
                                {formatDate(
                                  entry.changedAt,
                                )}
                              </p>
                            </div>

                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              {entry.statusChanged && (
                                <div className="rounded-lg bg-slate-50 p-3">
                                  <p className="text-xs font-semibold text-slate-500">
                                    Status
                                  </p>

                                  <p className="mt-1 text-sm text-slate-700">
                                    {entry.previousStatus ||
                                      'Empty'}{' '}
                                    →{' '}
                                    <strong>
                                      {entry.currentStatus ||
                                        'Empty'}
                                    </strong>
                                  </p>
                                </div>
                              )}

                              {entry.remarkChanged && (
                                <div className="rounded-lg bg-slate-50 p-3">
                                  <p className="text-xs font-semibold text-slate-500">
                                    Remark
                                  </p>

                                  <p className="mt-1 break-words text-sm text-slate-700">
                                    {entry.previousRemark ||
                                      'Empty'}{' '}
                                    →{' '}
                                    <strong>
                                      {entry.currentRemark ||
                                        'Empty'}
                                    </strong>
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        ),
                      )}

                      {!currentActionEntries.length && (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                          <p className="text-sm font-semibold text-slate-700">
                            No activity yet
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Status and remark
                            updates will appear
                            here.
                          </p>
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
};

export default ClientDatasetDetail;
