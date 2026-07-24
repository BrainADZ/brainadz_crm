import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';

const formatDate = (value) =>
  new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const EmployeeDatasets = () => {
  const [datasets, setDatasets] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAssignedDatasets = async () => {
      try {
        const token = localStorage.getItem('employeeToken');
        const response = await axios.get(`${API_BASE_URL}/api/client-datasets/assigned/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setDatasets(response.data);
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'Unable to load assigned data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssignedDatasets();
  }, []);

  const filteredDatasets = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return datasets;

    return datasets.filter((dataset) =>
      [dataset.name, dataset.year, dataset.originalFileName, dataset.businessUnitName].some(
        (value) =>
          String(value || '')
            .toLowerCase()
            .includes(normalizedSearch),
      ),
    );
  }, [datasets, searchTerm]);

  if (isLoading) {
    return (
      <div className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white shadow-sm" />
    );
  }

  return (
    <div className="w-full space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-emerald-600">Assigned datasets</p>
          <h1 className="mt-1.5 text-2xl font-semibold text-slate-950">Client data</h1>
          <p className="mt-1.5 text-sm leading-6 text-slate-500">
            Open a dataset to work only on the rows assigned to you.
          </p>
        </div>
        <span className="w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
          {datasets.length} datasets
        </span>
      </section>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">My assigned files</h2>
            <p className="mt-1 text-sm text-slate-500">
              Only datasets containing your assigned rows are shown.
            </p>
          </div>
          <label className="relative block sm:w-72">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search assigned data"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
              <tr>
                <th className="px-5 py-3">Dataset</th>
                <th className="whitespace-nowrap px-5 py-3">Business Unit</th>
                <th className="whitespace-nowrap px-5 py-3">Year</th>
                <th className="whitespace-nowrap px-5 py-3">Assigned rows</th>
                <th className="whitespace-nowrap px-5 py-3">Updated</th>
                <th className="px-5 py-3">Excel file</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDatasets.map((dataset) => (
                <tr key={dataset._id} className="transition hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <Link
                      to={`/employee-dashboard/datasets/${dataset._id}`}
                      className="inline-flex items-center gap-2 font-semibold text-emerald-700 hover:text-emerald-800"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4 fill-none stroke-current"
                        strokeWidth="2"
                      >
                        <path d="M4 4h16v16H4z" />
                        <path d="M4 10h16" />
                        <path d="M10 4v16" />
                      </svg>
                      {dataset.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                    {dataset.businessUnitName || 'Legacy data'}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                    {dataset.year || '-'}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      {dataset.rowCount} rows
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                    {formatDate(dataset.updatedAt || dataset.createdAt)}
                  </td>
                  <td className="px-5 py-4 text-slate-500">{dataset.originalFileName}</td>
                </tr>
              ))}
              {filteredDatasets.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-5 py-12 text-center text-sm text-slate-500">
                    No assigned dataset found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default EmployeeDatasets;
