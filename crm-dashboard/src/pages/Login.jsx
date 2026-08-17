import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  Globe2,
  LockKeyhole,
  Mail,
  Megaphone,
  Radio,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react';
import PasswordInput from '../components/PasswordInput';
import { API_BASE_URL } from '../config/api';
import { clearAllAuthTokens } from '../utils/auth';

// Replace this path with your imported BrainADZ logo when the asset is ready.
const brainAdzLogo = '/main-logo.png';

// Replace this path with your imported login background image.
const loginBackground = '/login-bg.png';

const inputClass =
  'h-14 w-full rounded-xl border border-slate-200 bg-white px-11 text-[0.95rem] font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100';

const capabilities = [
  {
    name: 'BrainADZ Marketing',
    description: 'Plan, execute and measure impactful marketing.',
    icon: Megaphone,
    color: 'blue',
  },
  {
    name: 'BrainADZ Live',
    description: 'Deliver seamless live experiences that engage.',
    icon: Radio,
    color: 'red',
  },
  {
    name: 'BrainADZ Exhibits',
    description: 'Design, showcase and build brand presence globally.',
    icon: Store,
    color: 'green',
  },
];

const stats = [
  { value: '500+', label: 'Clients', icon: Users, color: 'blue' },
  { value: '18+', label: 'Years of Excellence', icon: Award, color: 'red' },
  { value: 'PAN India +', label: 'Global Capability', icon: Globe2, color: 'green' },
];

const colorClasses = {
  blue: {
    icon: 'bg-blue-50 text-blue-600',
    line: 'bg-blue-600',
  },
  red: {
    icon: 'bg-red-50 text-red-500',
    line: 'bg-red-500',
  },
  green: {
    icon: 'bg-green-50 text-green-600',
    line: 'bg-green-500',
  },
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
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

      clearAllAuthTokens();
      const workspace = response.data.workspace === 'admin' ? 'admin' : 'employee';
      localStorage.setItem(
        workspace === 'admin' ? 'adminToken' : 'employeeToken',
        response.data.token,
      );
      localStorage.setItem('currentUser', JSON.stringify(response.data.user || {}));
      // Both admins and employees use the same CRM shell. The sidebar is filtered
      // from their resolved role permissions after sign-in.
      navigate('/dashboard', { replace: true });
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
    <main className="relative min-h-screen overflow-hidden bg-white lg:grid lg:grid-cols-[58%_42%]">
      <img
        src={loginBackground}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />

      <section className="relative hidden min-h-screen px-10 py-9 lg:flex lg:flex-col xl:px-16 xl:py-10">
        <img
          src={brainAdzLogo}
          alt="BrainADZ"
          className="h-28 w-auto max-w-[28rem] object-contain object-left"
        />

        <div className="my-auto max-w-[760px] py-5">
          <div>
            <h1 className="relative max-w-170 text-[2.25rem] font-extrabold leading-[1.2] text-[#133777] xl:text-[2.75rem]">
              Access every BrainADZ
              <br />
              capability from one secure
              <br />
              workspace.
            </h1>
            <p className="relative mt-5 max-w-162.5 text-base leading-7 text-slate-600">
              One company. One workspace. Empower your teams across Marketing, Live and
              Exhibitions with clarity, control and complete visibility.
            </p>
          </div>

          <div className="mt-7 grid grid-cols-3 gap-3.5">
            {capabilities.map(({ name, description, icon: Icon, color }) => (
              <article
                key={name}
                className="min-h-[172px] rounded-xl border border-slate-200/80 bg-white/90 p-4.5 shadow-[0_12px_35px_-28px_rgba(15,23,42,0.5)] backdrop-blur"
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${colorClasses[color].icon}`}
                >
                  <Icon size={21} />
                </span>
                <span className={`mt-3 block h-0.5 w-6 ${colorClasses[color].line}`} />
                <h2 className="mt-3 text-[0.92rem] font-extrabold text-[#173a7a]">{name}</h2>
                <p className="mt-1.5 text-xs leading-5 text-slate-500">{description}</p>
              </article>
            ))}
          </div>

          <div className="mt-5 grid min-h-[68px] grid-cols-3 rounded-xl border border-slate-200/80 bg-white/90 px-3 py-3 shadow-[0_12px_35px_-28px_rgba(15,23,42,0.5)] backdrop-blur">
            {stats.map(({ value, label, icon: Icon, color }, index) => (
              <div
                key={value}
                className={`flex items-center justify-center gap-3 px-2 ${index ? 'border-l border-slate-200' : ''
                  }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${colorClasses[color].icon}`}
                >
                  <Icon size={18} />
                </span>
                <div>
                  <p className="text-[0.95rem] font-extrabold text-[#173a7a]">{value}</p>
                  <p className="text-[0.7rem] text-slate-500">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center px-5 py-8 sm:px-8 lg:px-8 xl:-translate-x-10 xl:px-8">
        <div className="w-full max-w-142.5 rounded-2xl border border-white/90 bg-white/95 p-6 shadow-[0_24px_70px_-25px_rgba(15,38,82,0.22)] backdrop-blur sm:p-10 xl:p-12">
          <img
            src={brainAdzLogo}
            alt="BrainADZ"
            className="mb-2 h-20 w-auto max-w-[21rem] object-contain object-left lg:hidden"
          />

          <div className="flex justify-end">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <ShieldCheck size={23} />
              </span>
              <div>
                <p className="text-xs font-extrabold text-[#173a7a]">Secure access</p>
                <p className="mt-0.5 text-[0.65rem] text-slate-400">Your data is protected</p>
              </div>
            </div>
          </div>

          <h2 className="mt-9 text-4xl font-extrabold tracking-tight text-[#133777]">Sign in</h2>
          <p className="mt-2 max-w-md text-[0.95rem] leading-6 text-slate-500">
            Enter your company credentials. We&apos;ll open the correct workspace automatically.
          </p>

          <form onSubmit={handleLogin} className="mt-8">
            <label className="block">
              <span className="mb-2 block text-sm font-extrabold text-[#1d3869]">Email address</span>
              <div className="relative">
                <Mail
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  className={inputClass}
                  type="email"
                  placeholder="admin@brainadz.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </label>

            <label className="mt-6 block">
              <span className="mb-2 block text-sm font-extrabold text-[#1d3869]">Password</span>
              <PasswordInput
                className={inputClass}
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            <div className="mt-5 flex items-center justify-between gap-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-4 w-4 accent-[#173f8c]"
                />
                Remember me
              </label>
              <button
                type="button"
                className="text-sm font-semibold text-blue-600 transition hover:text-blue-800"
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold leading-5 text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-7 flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#173777] to-[#1b4699] px-4 text-base font-bold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400"
            >
              {loading ? 'Signing in...' : 'Continue to CRM'}
              {!loading && <ArrowRight size={19} />}
            </button>
          </form>

          <div className="mt-8 flex items-center justify-center gap-2 border-t border-slate-200 pt-6 text-xs font-medium text-slate-400">
            <LockKeyhole size={13} />
            <span>Access is assigned by your administrator.</span>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Login;
