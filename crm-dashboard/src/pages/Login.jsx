import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, CheckCircle2, ShieldCheck } from 'lucide-react';
import PasswordInput from '../components/PasswordInput';
import { API_BASE_URL } from '../config/api';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, { email, password });
      if (!response.data?.token) throw new Error('Missing login token');

      localStorage.removeItem('adminToken');
      localStorage.removeItem('employeeToken');
      const workspace = response.data.workspace === 'admin' ? 'admin' : 'employee';
      localStorage.setItem(
        workspace === 'admin' ? 'adminToken' : 'employeeToken',
        response.data.token,
      );
      localStorage.setItem('currentUser', JSON.stringify(response.data.user || {}));
      navigate(workspace === 'admin' ? '/dashboard' : '/employee-dashboard', { replace: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          (requestError.request
            ? 'CRM server is unavailable. Start the backend and try again.'
            : 'Unable to sign in. Please try again.'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#0d2f73] lg:flex lg:flex-col lg:justify-between lg:p-14 xl:p-20">
        <div className="absolute -left-40 -top-44 h-[34rem] w-[34rem] rounded-full border-[7rem] border-white/[0.04]" />
        <div className="absolute -bottom-52 -right-40 h-[38rem] w-[38rem] rounded-full border-[8rem] border-blue-300/[0.06]" />
        <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[3rem] bg-blue-500/10" />

        <div className="relative flex items-center gap-3 text-white">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#123985] shadow-lg">
            <Building2 size={22} />
          </span>
          <div>
            <p className="text-base font-bold">BrainAdz CRM</p>
            <p className="text-xs font-medium text-blue-200">Company Operations Platform</p>
          </div>
        </div>

        <div className="relative max-w-xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-200">
            One company. One workspace.
          </p>
          <h1 className="mt-5 text-4xl font-bold leading-tight text-white xl:text-5xl">
            Work across every BrainAdz vertical with clarity.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-blue-100/85">
            Your role, team and department decide what you can access after a single secure login.
          </p>

          <div className="mt-9 grid gap-3 sm:grid-cols-3">
            {['BrainAdz Marketing', 'BrainAdz Exhibitions', 'BrainAdz Live'].map((vertical) => (
              <div
                key={vertical}
                className="rounded-xl border border-white/10 bg-white/[0.07] p-3.5 backdrop-blur-sm"
              >
                <CheckCircle2 size={17} className="text-blue-200" />
                <p className="mt-2 text-sm font-bold leading-5 text-white">{vertical}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs font-medium text-blue-200/70">
          Protected by role-based access control
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10 sm:px-8">
        <div className="w-full max-w-[27rem]">
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Building2 size={22} />
            </span>
            <div>
              <p className="font-bold text-slate-950">BrainAdz CRM</p>
              <p className="text-xs text-slate-500">Company Operations Platform</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_20px_55px_-30px_rgba(15,23,42,0.35)] sm:p-8">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <ShieldCheck size={20} />
            </span>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-slate-950">Sign in</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Enter your company credentials. We’ll open the correct workspace automatically.
            </p>

            <form onSubmit={handleLogin} className="mt-7 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-700">Email address</span>
                <input
                  className={inputClass}
                  type="email"
                  placeholder="name@brainadz.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-700">Password</span>
                <PasswordInput
                  className={inputClass}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>

              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold leading-5 text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {loading ? 'Signing in...' : 'Continue to CRM'}
                {!loading && <ArrowRight size={17} />}
              </button>
            </form>
          </div>

          <p className="mt-5 text-center text-xs font-medium text-slate-400">
            Access is assigned by your administrator.
          </p>
        </div>
      </section>
    </main>
  );
};

export default Login;
