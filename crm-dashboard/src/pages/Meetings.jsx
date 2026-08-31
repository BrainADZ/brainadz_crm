import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import {
  Building2,
  CalendarDays,
  Clock3,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Users,
  Video,
  X,
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { getValidToken } from '../utils/auth';

const filters = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'today', label: 'Today' },
  { id: 'all', label: 'All' },
  { id: 'past', label: 'Past' },
];
const inputClass =
  'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-600';
const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const defaultTime = () => {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return `${String(date.getHours()).padStart(2, '0')}:00`;
};
const blankMeeting = () => ({
  meetingTitle: '',
  datasetId: '',
  rowIndex: '',
  employeeId: '',
  businessUnitId: '',
  departmentId: '',
  meetingDate: localDate(),
  meetingTime: defaultTime(),
  durationMinutes: '30',
  meetingMode: 'Online',
  platformOrLocation: '',
  participantUserIds: [],
  notes: '',
});
const headers = () => ({
  Authorization: `Bearer ${getValidToken('admin') || getValidToken('employee') || ''}`,
});
const idOf = (value) => String(value?._id || value || '');

const formatDateTime = (date, time) => {
  const value = new Date(`${date}T${time || '00:00'}`);
  if (Number.isNaN(value.getTime())) return 'Date not available';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
};

const Meetings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const handledPrefillRef = useRef('');
  const [meetings, setMeetings] = useState([]);
  const [options, setOptions] = useState({
    businessUnits: [],
    departments: [],
    employees: [],
    actions: [],
  });
  const [meetingFilter, setMeetingFilter] = useState('upcoming');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(blankMeeting);
  const [linkedContext, setLinkedContext] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [meetingResponse, optionResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/meetings`, { headers: headers() }),
        axios.get(`${API_BASE_URL}/api/meetings/options`, { headers: headers() }),
      ]);
      setMeetings(meetingResponse.data || []);
      setOptions(
        optionResponse.data || { businessUnits: [], departments: [], employees: [], actions: [] },
      );
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load meetings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const requestedMeetingId = searchParams.get('meetingId') || '';
  const requestedDatasetId = searchParams.get('datasetId') || '';
  const requestedRowIndex = searchParams.get('rowIndex') || '';
  const shouldCreateLinkedMeeting =
    searchParams.get('create') === '1' && requestedDatasetId && requestedRowIndex !== '';

  useEffect(() => {
    if (!requestedMeetingId) return undefined;
    setMeetingFilter('all');
    setDepartmentFilter('all');
    setSearch('');

    const timeoutId = window.setTimeout(() => {
      document
        .getElementById(`meeting-${requestedMeetingId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    return () => window.clearTimeout(timeoutId);
  }, [meetings, requestedMeetingId]);

  useEffect(() => {
    if (!shouldCreateLinkedMeeting || loading) return;

    const prefillKey = `${requestedDatasetId}:${requestedRowIndex}`;
    if (handledPrefillRef.current === prefillKey) return;
    handledPrefillRef.current = prefillKey;

    const loadLinkedContext = async () => {
      setError('');
      try {
        const response = await axios.get(`${API_BASE_URL}/api/meetings/context`, {
          headers: headers(),
          params: { datasetId: requestedDatasetId, rowIndex: requestedRowIndex },
        });
        const context = response.data || {};
        if (!context.canSchedule) {
          handledPrefillRef.current = '';
          setError(
            context.status !== 'Interested'
              ? 'Client status must be Interested before scheduling a meeting.'
              : 'Assign an active employee with Department access before scheduling this meeting.',
          );
          return;
        }
        const businessUnitId = idOf(context.businessUnitId);
        const preferredDepartmentId = idOf(context.departmentId);
        const fallbackDepartment = options.departments.find((department) =>
          (department.businessUnitIds || []).map(idOf).includes(businessUnitId),
        );
        const departmentId =
          preferredDepartmentId &&
          options.departments.some((department) => idOf(department) === preferredDepartmentId)
            ? preferredDepartmentId
            : idOf(fallbackDepartment);
        const clientLabel = context.clientName || context.companyName || context.datasetName;

        setLinkedContext(context);
        setForm({
          ...blankMeeting(),
          meetingTitle: clientLabel ? `${clientLabel} - Client Meeting` : 'Client Meeting',
          datasetId: requestedDatasetId,
          rowIndex: requestedRowIndex,
          employeeId:
            idOf(context.suggestedEmployeeId) || idOf(context.assignedEmployees?.[0]),
          businessUnitId,
          departmentId,
        });
        setModalOpen(true);
      } catch (requestError) {
        handledPrefillRef.current = '';
        setError(
          requestError.response?.data?.message || 'Unable to load the interested client details',
        );
      }
    };

    loadLinkedContext();
  }, [
    loading,
    options.departments,
    requestedDatasetId,
    requestedRowIndex,
    shouldCreateLinkedMeeting,
  ]);

  const today = localDate();
  const filtered = useMemo(
    () =>
      meetings.filter((meeting) => {
        const date = meeting.meetingDate || '';
        const matchesPeriod =
          meetingFilter === 'today'
            ? date === today
            : meetingFilter === 'upcoming'
              ? date >= today
              : meetingFilter === 'past'
                ? date < today
                : true;
        const matchesDepartment =
          departmentFilter === 'all' || idOf(meeting.departmentId) === departmentFilter;
        const query = search.trim().toLowerCase();
        const matchesSearch =
          !query ||
          [
            meeting.meetingTitle,
            meeting.employee?.name,
            meeting.departmentId?.name,
            meeting.businessUnitId?.name,
            meeting.clientName,
            meeting.companyName,
            meeting.datasetName,
            meeting.meetingMode,
            meeting.platformOrLocation,
            meeting.notes,
            ...(meeting.participantUserIds || []).map((user) => user.name),
          ].some((value) =>
            String(value || '')
              .toLowerCase()
              .includes(query),
          );
        return matchesPeriod && matchesDepartment && matchesSearch;
      }),
    [departmentFilter, meetingFilter, meetings, search, today],
  );

  const stats = [
    ['All meetings', meetings.length, 'Department schedule'],
    [
      'Upcoming',
      meetings.filter((meeting) => meeting.meetingDate >= today && meeting.status !== 'cancelled')
        .length,
      'Today and later',
    ],
    [
      'Today',
      meetings.filter((meeting) => meeting.meetingDate === today && meeting.status !== 'cancelled')
        .length,
      'Scheduled today',
    ],
    [
      'Departments',
      new Set(meetings.map((meeting) => idOf(meeting.departmentId)).filter(Boolean)).size,
      'Visible to you',
    ],
  ];

  const openScheduler = () => {
    const businessUnit = options.businessUnits[0];
    const department =
      options.departments.find((item) =>
        (item.businessUnitIds || []).map(idOf).includes(idOf(businessUnit)),
      ) || options.departments[0];
    setForm({
      ...blankMeeting(),
      businessUnitId: idOf(businessUnit),
      departmentId: idOf(department),
    });
    setLinkedContext(null);
    setError('');
    setModalOpen(true);
  };

  const closeScheduler = () => {
    setModalOpen(false);
    setLinkedContext(null);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('create');
    nextParams.delete('datasetId');
    nextParams.delete('rowIndex');
    setSearchParams(nextParams, { replace: true });
    handledPrefillRef.current = '';
  };

  const linkedEmployees = (linkedContext?.assignedEmployees || []).filter(
    (employee) => employee.canSchedule !== false,
  );
  const selectedLinkedEmployee = linkedEmployees.find(
    (employee) => employee._id === form.employeeId,
  );
  const availableDepartments = options.departments.filter((department) => {
    const belongsToBusinessUnit =
      !form.businessUnitId ||
      (department.businessUnitIds || []).map(idOf).includes(form.businessUnitId);
    const employeeCanAttend =
      !linkedContext ||
      !selectedLinkedEmployee?.schedulableDepartmentIds?.length ||
      selectedLinkedEmployee.schedulableDepartmentIds.includes(idOf(department));
    return belongsToBusinessUnit && employeeCanAttend;
  });
  const availableParticipants = options.employees.filter(
    (employee) =>
      employee.departmentIds?.includes(form.departmentId) &&
      employee.businessUnitIds?.includes(form.businessUnitId) &&
      employee._id !== form.employeeId,
  );
  const reminderEmployee =
    linkedEmployees.find((employee) => employee._id === form.employeeId) ||
    options.employees.find((employee) => employee._id === form.employeeId);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/meetings`,
        { ...form, durationMinutes: Number(form.durationMinutes) },
        { headers: headers() },
      );
      setMeetings((current) =>
        [...current, response.data.meeting].sort((a, b) =>
          `${a.meetingDate}${a.meetingTime}`.localeCompare(`${b.meetingDate}${b.meetingTime}`),
        ),
      );
      setMessage(response.data.message);
      closeScheduler();
      setMeetingFilter('upcoming');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to schedule meeting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[96rem] space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            Team calendar
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Meetings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Schedule and track meetings across Business Units and Departments.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative sm:w-72">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search meetings..."
              className={`${inputClass} pl-9`}
            />
          </label>
          <button
            type="button"
            onClick={() => load({ silent: true })}
            title="Refresh"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
          {options.actions.includes('create') && (
            <button
              type="button"
              onClick={openScheduler}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus size={17} />
              Schedule Meeting
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
              setError('');
              setMessage('');
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, note], index) => (
          <article
            key={label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {label}
              </p>
              {index === 3 ? (
                <Building2 size={17} className="text-violet-600" />
              ) : (
                <CalendarDays size={17} className="text-blue-600" />
              )}
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{note}</p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Meeting schedule</h2>
            <p className="mt-1 text-xs text-slate-500">{filtered.length} meetings in this view</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
              className={`${inputClass} sm:w-52`}
            >
              <option value="all">All Departments</option>
              {options.departments.map((department) => (
                <option key={department._id} value={department._id}>
                  {department.name}
                </option>
              ))}
            </select>
            <div className="flex rounded-lg border border-slate-300 bg-slate-50 p-1">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setMeetingFilter(filter.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${meetingFilter === filter.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[70rem] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date & time</th>
                <th className="px-4 py-3">Meeting</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Organizer</th>
                <th className="px-4 py-3">Participants</th>
                <th className="px-4 py-3">Mode & place</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((meeting) => (
                <tr
                  id={`meeting-${meeting._id}`}
                  key={meeting._id}
                  className={`align-top transition hover:bg-blue-50/30 ${
                    requestedMeetingId === meeting._id
                      ? 'bg-blue-50 ring-2 ring-inset ring-blue-400'
                      : ''
                  }`}
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    <p className="font-semibold text-slate-900">
                      {formatDateTime(meeting.meetingDate, meeting.meetingTime)}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <Clock3 size={12} />
                      {meeting.durationMinutes || 30} minutes
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{meeting.meetingTitle}</p>
                    {(meeting.clientName || meeting.companyName) && (
                      <p className="mt-1 text-xs font-semibold text-blue-700">
                        Client: {meeting.clientName || meeting.companyName}
                        {meeting.clientName &&
                          meeting.companyName &&
                          meeting.clientName !== meeting.companyName
                          ? ` · ${meeting.companyName}`
                          : ''}
                      </p>
                    )}
                    {meeting.datasetName && (
                      <p className="mt-1 text-[11px] font-medium text-slate-400">
                        Dataset: {meeting.datasetName}
                      </p>
                    )}
                    <p className="mt-1 max-w-64 truncate text-xs text-slate-500">
                      {meeting.notes || 'No agenda added'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-700">
                      {meeting.departmentId?.name || meeting.officeModule || 'General'}
                    </p>
                    <p className="mt-1 text-xs text-blue-700">
                      {meeting.businessUnitId?.name || meeting.communityKey}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-700">
                      {meeting.employee?.name || 'Employee'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {meeting.employee?.position || meeting.employee?.employeeId}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-56 flex-wrap gap-1">
                      {meeting.participantUserIds?.length ? (
                        meeting.participantUserIds.map((participant) => (
                          <span
                            key={participant._id}
                            className="rounded-full bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700"
                          >
                            {participant.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">Organizer only</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      {meeting.meetingMode === 'Online' ? (
                        <Video size={12} />
                      ) : (
                        <MapPin size={12} />
                      )}
                      {meeting.meetingMode}
                    </span>
                    <p className="mt-1 max-w-48 truncate text-xs text-slate-500">
                      {meeting.platformOrLocation || 'Not specified'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${meeting.status === 'cancelled' ? 'bg-red-50 text-red-700' : meeting.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}
                    >
                      {meeting.status || 'scheduled'}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && !filtered.length && (
                <tr>
                  <td colSpan="7" className="px-4 py-16 text-center">
                    <CalendarDays size={30} className="mx-auto text-slate-300" />
                    <p className="mt-3 font-semibold text-slate-600">No meetings scheduled</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Schedule the first department meeting from the button above.
                    </p>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan="7" className="px-4 py-16 text-center text-slate-500">
                    Loading meeting schedule...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4">
          <form
            onSubmit={submit}
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          >
            <div className="sticky top-0 z-20 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Department calendar
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">Schedule Meeting</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Add timing, participants and meeting details.
                </p>
              </div>
              <button
                type="button"
                onClick={closeScheduler}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={19} />
              </button>
            </div>
            <div className="space-y-6 p-6">
              {linkedContext && (
                <section className="rounded-xl border border-blue-200 bg-blue-50/70 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700">
                    Interested client
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    {linkedContext.clientName ||
                      linkedContext.companyName ||
                      linkedContext.datasetName}
                  </p>
                  {linkedContext.clientName &&
                    linkedContext.companyName &&
                    linkedContext.clientName !== linkedContext.companyName && (
                      <p className="mt-0.5 text-sm text-slate-600">
                        {linkedContext.companyName}
                      </p>
                    )}
                  <p className="mt-2 text-xs text-slate-500">
                    Dataset: {linkedContext.datasetName} · Row {Number(linkedContext.rowIndex) + 1}
                  </p>
                  <p className="mt-2 text-xs font-medium text-blue-800">
                    On the meeting date, the assigned employee will receive a bell notification
                    and, when email delivery is configured, an email reminder.
                  </p>
                </section>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className={labelClass}>Meeting title *</span>
                  <input
                    required
                    value={form.meetingTitle}
                    onChange={(event) => setForm({ ...form, meetingTitle: event.target.value })}
                    placeholder="e.g. Weekly Marketing Review"
                    className={inputClass}
                  />
                </label>
                <label>
                  <span className={labelClass}>Business Unit *</span>
                  <select
                    required
                    value={form.businessUnitId}
                    disabled={Boolean(linkedContext)}
                    onChange={(event) => {
                      const businessUnitId = event.target.value;
                      const department = options.departments.find((item) =>
                        (item.businessUnitIds || []).map(idOf).includes(businessUnitId),
                      );
                      setForm({
                        ...form,
                        businessUnitId,
                        departmentId: idOf(department),
                        participantUserIds: [],
                      });
                    }}
                    className={inputClass}
                  >
                    <option value="">Select Business Unit</option>
                    {options.businessUnits.map((unit) => (
                      <option key={unit._id} value={unit._id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                </label>
                {linkedContext && (
                  <label className="sm:col-span-2">
                    <span className={labelClass}>Assigned employee / reminder recipient *</span>
                    <select
                      required
                      value={form.employeeId}
                      onChange={(event) => {
                        const employeeId = event.target.value;
                        const employee = linkedEmployees.find(
                          (item) => item._id === employeeId,
                        );
                        const allowedDepartmentIds = employee?.schedulableDepartmentIds || [];
                        const departmentId = allowedDepartmentIds.includes(form.departmentId)
                          ? form.departmentId
                          : allowedDepartmentIds[0] || form.departmentId;
                        setForm({
                          ...form,
                          employeeId,
                          departmentId,
                          participantUserIds: form.participantUserIds.filter(
                            (participantId) => participantId !== employeeId,
                          ),
                        });
                      }}
                      className={inputClass}
                    >
                      <option value="">Select assigned employee</option>
                      {linkedEmployees.map((employee) => (
                        <option key={employee._id} value={employee._id}>
                          {employee.name || employee.email}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1.5 block text-xs text-slate-500">
                      {reminderEmployee?.email
                        ? `Reminder email: ${reminderEmployee.email}`
                        : 'The selected employee must have an email address.'}
                    </span>
                  </label>
                )}
                <label>
                  <span className={labelClass}>Department *</span>
                  <select
                    required
                    value={form.departmentId}
                    onChange={(event) =>
                      setForm({ ...form, departmentId: event.target.value, participantUserIds: [] })
                    }
                    className={inputClass}
                  >
                    <option value="">Select Department</option>
                    {availableDepartments.map((department) => (
                      <option key={department._id} value={department._id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Date *</span>
                  <input
                    required
                    type="date"
                    min={today}
                    value={form.meetingDate}
                    onChange={(event) => setForm({ ...form, meetingDate: event.target.value })}
                    className={inputClass}
                  />
                </label>
                <label>
                  <span className={labelClass}>Start time *</span>
                  <input
                    required
                    type="time"
                    value={form.meetingTime}
                    onChange={(event) => setForm({ ...form, meetingTime: event.target.value })}
                    className={inputClass}
                  />
                </label>
                <label>
                  <span className={labelClass}>Duration</span>
                  <select
                    value={form.durationMinutes}
                    onChange={(event) => setForm({ ...form, durationMinutes: event.target.value })}
                    className={inputClass}
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="90">1.5 hours</option>
                    <option value="120">2 hours</option>
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Meeting mode</span>
                  <select
                    value={form.meetingMode}
                    onChange={(event) => setForm({ ...form, meetingMode: event.target.value })}
                    className={inputClass}
                  >
                    <option>Online</option>
                    <option>Physical</option>
                    <option>Phone</option>
                  </select>
                </label>
                <label className="sm:col-span-2">
                  <span className={labelClass}>Meeting link / location</span>
                  <input
                    value={form.platformOrLocation}
                    onChange={(event) =>
                      setForm({ ...form, platformOrLocation: event.target.value })
                    }
                    placeholder={
                      form.meetingMode === 'Physical'
                        ? 'Office / venue address'
                        : 'Google Meet / Zoom link'
                    }
                    className={inputClass}
                  />
                </label>
              </div>
              <fieldset>
                <legend className={labelClass}>Participants (optional)</legend>
                <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                  {availableParticipants.map((employee) => {
                    const checked = form.participantUserIds.includes(employee._id);
                    return (
                      <label
                        key={employee._id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 ${checked ? 'bg-blue-50' : 'bg-white hover:bg-slate-100'}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setForm({
                              ...form,
                              participantUserIds: checked
                                ? form.participantUserIds.filter((id) => id !== employee._id)
                                : [...form.participantUserIds, employee._id],
                            })
                          }
                          className="h-4 w-4 rounded border-slate-300 text-blue-600"
                        />
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                          <Users size={14} />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-slate-800">
                            {employee.name}
                          </span>
                          <span className="text-xs text-slate-500">
                            {employee.position || employee.employeeId || employee.email}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                  {!availableParticipants.length && (
                    <p className="px-3 py-8 text-center text-xs text-slate-500">
                      No employees available for this Department and Business Unit.
                    </p>
                  )}
                </div>
              </fieldset>
              <label>
                <span className={labelClass}>Agenda / notes</span>
                <textarea
                  rows="4"
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  placeholder="Topics to discuss, preparation or additional details..."
                  className={`${inputClass} h-auto py-3`}
                />
              </label>
              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </p>
              )}
            </div>
            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={closeScheduler}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                <CalendarDays size={16} />
                {saving ? 'Scheduling...' : 'Schedule Meeting'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Meetings;
