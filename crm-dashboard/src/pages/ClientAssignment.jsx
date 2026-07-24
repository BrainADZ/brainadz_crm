import { useEffect, useState } from 'react';
import axios from 'axios';
import Modal from 'react-modal';
import { API_BASE_URL, getAssetUrl } from '../config/api';

const avatarClasses = [
  'bg-blue-600',
  'bg-violet-600',
  'bg-rose-600',
  'bg-teal-600',
  'bg-amber-500',
  'bg-emerald-600',
];
const fieldClass =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100';

const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'EM';

const getAvatarClass = (name = '') =>
  avatarClasses[(name.charCodeAt(0) || 0) % avatarClasses.length];

const ClientAssignment = () => {
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedClients, setSelectedClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [reviewModalIsOpen, setReviewModalIsOpen] = useState(false);
  const [modalEmployee, setModalEmployee] = useState(null);
  const [modalAssignedClients, setModalAssignedClients] = useState([]);
  const [selectedClientForReview, setSelectedClientForReview] = useState(null);
  const [comments, setComments] = useState([]);

  const authConfig = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
  });

  const fetchAssignments = async () => {
    const response = await axios.get(`${API_BASE_URL}/api/clients/assignments`, authConfig());
    setAssignments(response.data);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [employeesResponse, clientsResponse, assignmentsResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/employees`, authConfig()),
          axios.get(`${API_BASE_URL}/api/clients`, authConfig()),
          axios.get(`${API_BASE_URL}/api/clients/assignments`, authConfig()),
        ]);
        setEmployees(employeesResponse.data);
        setClients(clientsResponse.data);
        setAssignments(assignmentsResponse.data);
      } catch (requestError) {
        console.error('Error loading assignment data:', requestError);
      }
    };

    fetchData();
  }, []);

  const handleAssign = async () => {
    try {
      await axios.post(
        `${API_BASE_URL}/api/clients/assign/bulk`,
        { clientIds: selectedClients, employeeId: selectedEmployee },
        authConfig(),
      );
      setSelectedEmployee('');
      setSelectedClients([]);
      await fetchAssignments();
    } catch (requestError) {
      console.error('Error assigning clients:', requestError);
      alert('Failed to assign clients');
    }
  };

  const handleUnassign = async (clientId) => {
    try {
      await axios.put(`${API_BASE_URL}/api/clients/${clientId}/unassign`, {}, authConfig());
      await fetchAssignments();
      setModalAssignedClients((previous) => previous.filter((client) => client._id !== clientId));
    } catch (requestError) {
      console.error('Error unassigning client:', requestError);
      alert('Failed to unassign client');
    }
  };

  const handleOpenModal = (employee) => {
    setModalEmployee(employee);
    setModalAssignedClients(
      assignments.filter(
        (assignment) => assignment.assignedTo && assignment.assignedTo._id === employee._id,
      ),
    );
    setModalIsOpen(true);
  };

  const handleReviewClick = async (client) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/clients/${client._id}/comments`,
        authConfig(),
      );
      setComments(response.data.callLogs || []);
      setSelectedClientForReview(client);
      setReviewModalIsOpen(true);
    } catch (requestError) {
      console.error('Error fetching client comments:', requestError);
    }
  };

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (!client.assignedTo || client.assignedTo._id !== selectedEmployee),
  );

  const employeeClientCount = (employeeId) =>
    assignments.filter(
      (assignment) => assignment.assignedTo && assignment.assignedTo._id === employeeId,
    ).length;

  const closeReviewModal = () => {
    setReviewModalIsOpen(false);
    setComments([]);
    setSelectedClientForReview(null);
  };

  return (
    <div className="w-full space-y-7">
      <section>
        <p className="text-xs font-semibold text-blue-600">Work allocation</p>
        <h1 className="mt-1.5 text-2xl font-semibold text-slate-950">Assign clients</h1>
        <p className="mt-1.5 text-sm leading-6 text-slate-500">
          Distribute client accounts and review team activity.
        </p>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-semibold text-slate-900">Assignment setup</h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose an employee and one or more clients.
            </p>
          </div>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Employee</span>
              <select
                className={fieldClass}
                value={selectedEmployee}
                onChange={(event) => setSelectedEmployee(event.target.value)}
              >
                <option value="">Select an employee...</option>
                {employees.map((employee) => (
                  <option key={employee._id} value={employee._id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">
                Search clients
              </span>
              <input
                type="search"
                className={fieldClass}
                placeholder="Type to filter clients..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={handleAssign}
              disabled={!selectedEmployee || selectedClients.length === 0}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Assign{' '}
              {selectedClients.length > 0
                ? `${selectedClients.length} selected client${selectedClients.length > 1 ? 's' : ''}`
                : 'clients'}
            </button>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Available clients</h2>
              <p className="mt-1 text-sm text-slate-500">
                Hold Ctrl or Cmd to select multiple records.
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
              {filteredClients.length} available
            </span>
          </div>
          <select
            multiple
            className="mt-5 min-h-56 w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            value={selectedClients}
            onChange={(event) =>
              setSelectedClients(Array.from(event.target.selectedOptions, (option) => option.value))
            }
          >
            {filteredClients.map((client) => (
              <option key={client._id} value={client._id} className="rounded-lg px-3 py-2">
                {client.name}
              </option>
            ))}
          </select>
          {filteredClients.length === 0 && (
            <p className="mt-3 text-sm text-slate-500">No unassigned clients match your search.</p>
          )}
        </article>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Team overview</h2>
            <p className="mt-1 text-sm text-slate-500">Review assignments for each employee.</p>
          </div>
          <span className="text-xs font-semibold text-slate-500">{employees.length} members</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {employees.map((employee) => {
            const clientCount = employeeClientCount(employee._id);
            return (
              <article
                key={employee._id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white ${getAvatarClass(employee.name)}`}
                >
                  {getInitials(employee.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{employee.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {clientCount} assigned client{clientCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenModal(employee)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  View
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <Modal
        isOpen={modalIsOpen}
        onRequestClose={() => setModalIsOpen(false)}
        contentLabel="Assigned clients"
        overlayClassName="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
        className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {modalEmployee && (
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-xl text-xs font-bold text-white ${getAvatarClass(modalEmployee.name)}`}
              >
                {getInitials(modalEmployee.name)}
              </span>
            )}
            <div>
              <h2 className="font-semibold text-slate-950">{modalEmployee?.name}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {modalAssignedClients.length} assigned clients
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModalIsOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-sm font-semibold text-slate-500 hover:bg-slate-50"
          >
            X
          </button>
        </div>

        <div className="mt-6 space-y-2">
          {modalAssignedClients.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
              No clients assigned yet.
            </p>
          ) : (
            modalAssignedClients.map((client) => (
              <div
                key={client._id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                  {client.name}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleUnassign(client._id)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                  >
                    Unassign
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReviewClick(client)}
                    disabled={!client.callLogs || client.callLogs.length === 0}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    Review
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      <Modal
        isOpen={reviewModalIsOpen}
        onRequestClose={closeReviewModal}
        contentLabel="Client comments"
        overlayClassName="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
        className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-slate-950">Call logs</h2>
            <p className="mt-1 text-xs text-slate-500">{selectedClientForReview?.name}</p>
          </div>
          <button
            type="button"
            onClick={closeReviewModal}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-sm font-semibold text-slate-500 hover:bg-slate-50"
          >
            X
          </button>
        </div>
        <div className="mt-6 space-y-3">
          {comments.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
              No call logs recorded yet.
            </p>
          ) : (
            comments.map((log, index) => (
              <article
                key={`${log.comment}-${index}`}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <p className="text-sm leading-6 text-slate-700">{log.comment}</p>
                <span className="mt-3 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  {log.callStatus}
                </span>
                {log.screenshotUrl && (
                  <img
                    src={getAssetUrl(log.screenshotUrl)}
                    alt="Call log screenshot"
                    className="mt-3 w-full rounded-lg border border-slate-200"
                  />
                )}
              </article>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ClientAssignment;
