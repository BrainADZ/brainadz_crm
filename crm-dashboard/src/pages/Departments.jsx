import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Building2, RefreshCw, Users } from 'lucide-react';
import { API_BASE_URL, getAssetUrl } from '../config/api';
import { getCommunities } from '../services/accessApi';
import { getAdminHeaders } from '../services/businessApi';

const VERTICALS = {
  marketing: {
    name: 'BrainAdz Marketing',
    shortName: 'Marketing',
    description: 'Digital marketing, content, creative and campaign operations.',
    tone: 'border-violet-200 bg-violet-50 text-violet-700',
  },
  exhibition: {
    name: 'BrainAdz Exhibitions',
    shortName: 'Exhibitions',
    description: 'Exhibition planning, stall delivery, vendors and site operations.',
    tone: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  live: {
    name: 'BrainAdz Live',
    shortName: 'Live',
    description: 'Live experiences, events, activations and production delivery.',
    tone: 'border-blue-200 bg-blue-50 text-blue-700',
  },
};

const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'EM';
const roleLabel = (value = '') =>
  value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const Departments = () => {
  const [communities, setCommunities] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedKey, setSelectedKey] = useState('marketing');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [communityData, employeeResponse] = await Promise.all([
        getCommunities(),
        axios.get(`${API_BASE_URL}/api/employees`, { headers: getAdminHeaders() }),
      ]);
      setCommunities(communityData || []);
      setEmployees(employeeResponse.data || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load departments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const departments = useMemo(
    () =>
      ['marketing', 'exhibition', 'live'].map((key) => {
        const stored = communities.find((community) => community.key === key);
        const members = employees.filter((employee) => employee.communities?.includes(key));
        return { ...VERTICALS[key], ...stored, key, name: VERTICALS[key].name, members };
      }),
    [communities, employees],
  );

  const selected =
    departments.find((department) => department.key === selectedKey) || departments[0];

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white">
            <Building2 size={20} />
          </span>
          <div>
            <p className="text-xs font-bold text-slate-500">Company structure</p>
            <h1 className="text-2xl font-bold text-slate-950">Departments & Verticals</h1>
            <p className="mt-1 text-sm text-slate-500">
              Three fixed BrainAdz business verticals. Employees may work in one or multiple
              verticals.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </section>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <section className="grid gap-3 lg:grid-cols-3">
        {departments.map((department) => (
          <button
            key={department.key}
            type="button"
            onClick={() => setSelectedKey(department.key)}
            className={`rounded-xl border p-5 text-left shadow-sm transition ${selectedKey === department.key ? `${department.tone} ring-2 ring-blue-100` : 'border-slate-200 bg-white hover:border-blue-200'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-lg border ${department.tone}`}
              >
                <Building2 size={19} />
              </span>
              <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold">
                {department.members.length} employees
              </span>
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-950">{department.name}</h2>
            <p className="mt-2 text-sm leading-5 text-slate-600">{department.description}</p>
            <p className="mt-4 text-xs font-bold uppercase tracking-wide">
              Vertical key: {department.key}
            </p>
          </button>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-600">
              Selected vertical
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">{selected?.name}</h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
            <Users size={14} /> {selected?.members.length || 0} Employees
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[48rem] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Designation</th>
                <th className="px-4 py-3">CRM Role</th>
                <th className="px-4 py-3">Other Verticals</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {selected?.members.map((employee) => (
                <tr key={employee._id} className="hover:bg-blue-50/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {employee.imageUrl ? (
                        <img
                          src={getAssetUrl(employee.imageUrl)}
                          alt=""
                          className="h-9 w-9 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                          {initials(employee.name)}
                        </span>
                      )}
                      <div>
                        <p className="font-bold text-slate-900">{employee.name}</p>
                        <p className="text-xs text-slate-500">{employee.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{employee.team || '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{employee.position || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">
                      {roleLabel(employee.roleKey || employee.crmRole)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {employee.communities
                        ?.filter((key) => key !== selectedKey)
                        .map((key) => (
                          <span
                            key={key}
                            className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600"
                          >
                            {VERTICALS[key]?.shortName || key}
                          </span>
                        ))}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !selected?.members.length && (
                <tr>
                  <td
                    colSpan="5"
                    className="px-4 py-14 text-center text-sm font-semibold text-slate-500"
                  >
                    No employees assigned to this vertical yet.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td
                    colSpan="5"
                    className="px-4 py-14 text-center text-sm font-semibold text-slate-500"
                  >
                    Loading department...
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

export default Departments;
