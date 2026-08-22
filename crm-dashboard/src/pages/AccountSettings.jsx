import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PasswordInput from '../components/PasswordInput';
import { API_BASE_URL } from '../config/api';
import { clearAuthToken, getValidToken } from '../utils/auth';
import { applyTheme, getStoredTheme } from '../utils/theme';

const sections = [
  { id: 'appearance', label: 'Appearance & Theme' },
  { id: 'personal', label: 'Personal Information' },
  { id: 'advanced', label: 'Advanced User Details' },
  { id: 'password', label: 'Change My Password' },
  { id: 'login-history', label: 'Login History' },
  { id: 'language', label: 'Language & Time Zone' },
];

const fieldClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500';
const labelClass = 'text-right text-xs font-bold text-slate-600';
const selectClass = `${fieldClass} pr-8`;

const timezones = [
  '(GMT+05:30) India Standard Time (Asia/Kolkata)',
  '(GMT+00:00) Greenwich Mean Time (UTC)',
  '(GMT-05:00) Eastern Time (America/New_York)',
  '(GMT-08:00) Pacific Time (America/Los_Angeles)',
  '(GMT+01:00) Central European Time (Europe/Berlin)',
];

const locales = [
  'English (India)',
  'English (United States)',
  'English (United Kingdom)',
  'Hindi (India)',
];
const languages = ['English', 'Hindi'];
const encodings = ['Unicode (UTF-8)', 'Western (ISO-8859-1)'];
const countryOptions = ['India', 'United States', 'United Kingdom', 'Canada', 'Australia'];
const stateOptions = ['--None--', 'Delhi', 'Haryana', 'Karnataka', 'Maharashtra', 'Uttar Pradesh'];
const securityQuestions = [
  'In what city were you born?',
  'What is your favorite school teacher name?',
  'What is your first company name?',
  'What was the name of your first pet?',
];

const getTokenKey = (role) => (role === 'admin' ? 'adminToken' : 'employeeToken');

const splitName = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
  };
};

const getAlias = (profile) =>
  profile?.alias ||
  profile?.name
    ?.split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 8)
    .toUpperCase() ||
  'USER';

const formatDateTime = (value) => {
  if (!value) return 'Not available';

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(new Date(value));
};

const buildPersonalForm = (profile) => {
  const { firstName, lastName } = splitName(profile?.name);

  return {
    firstName,
    lastName,
    alias: getAlias(profile),
    email: profile?.email || '',
    username: profile?.email || '',
    nickname: profile?.nickname || profile?.email?.split('@')[0] || '',
    phone: profile?.phone || '',
    mobile: profile?.mobile || '',
    position: profile?.position || '',
    country: profile?.country || 'India',
    street: profile?.street || profile?.address || '',
    city: profile?.city || '',
    stateProvince: profile?.stateProvince || '--None--',
    postalCode: profile?.postalCode || '',
  };
};

const buildPreferenceForm = (profile) => ({
  timezone: profile?.timezone || timezones[0],
  locale: profile?.locale || locales[0],
  language: profile?.language || languages[0],
  emailEncoding: profile?.emailEncoding || encodings[0],
});

const buildPasswordForm = (profile) => ({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  securityQuestion: profile?.securityQuestion || securityQuestions[0],
  securityAnswer: '',
});

const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const PageShell = ({ activeSection, children }) => {
  const active = sections.find((section) => section.id === activeSection) || sections[0];

  return (
    <div className="min-h-[calc(100vh-8rem)] rounded-none bg-slate-50">
      <div className="mb-6 flex items-center gap-3 px-1">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm">
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6 fill-none stroke-current"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
          </svg>
        </span>
        <h1 className="text-2xl font-semibold text-slate-950">{active.label}</h1>
      </div>
      {children}
    </div>
  );
};

const SectionPanel = ({ title, children, help = true }) => (
  <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center justify-between gap-4 border-b-2 border-slate-500 bg-white px-4 py-3">
      <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
      {help && (
        <span className="hidden items-center gap-1 text-xs font-semibold text-blue-700 sm:inline-flex">
          Help for this Page
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white">
            ?
          </span>
        </span>
      )}
    </div>
    {children}
  </section>
);

const Subsection = ({ title, children }) => (
  <div className="border-b border-slate-200 last:border-b-0">
    <div className="bg-slate-200 px-4 py-2 text-sm font-bold text-slate-950">{title}</div>
    <div className="px-4 py-4">{children}</div>
  </div>
);

const FieldRow = ({ label, required = false, children }) => (
  <label className="grid items-center gap-2 sm:grid-cols-[12rem_minmax(0,24rem)]">
    <span className={labelClass}>
      {required && <span className="mr-1 text-red-600">*</span>}
      {label}
    </span>
    {children}
  </label>
);

const ReadRow = ({ label, value }) => (
  <div className="grid grid-cols-[11rem_1fr] border-b border-slate-100 px-3 py-2 text-sm last:border-b-0">
    <span className="text-right text-xs font-bold text-slate-500">{label}</span>
    <span className="pl-5 font-semibold text-slate-900">{value || 'Not added'}</span>
  </div>
);

const Message = ({ type, children }) => {
  if (!children) return null;

  const className =
    type === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  return (
    <p className={`rounded-lg border px-3 py-2 text-sm font-semibold ${className}`}>{children}</p>
  );
};

const AccountSettings = ({ role }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get('section');
  const activeSection = sections.some((section) => section.id === sectionParam)
    ? sectionParam
    : 'personal';

  const [quickFind, setQuickFind] = useState('');
  const [profile, setProfile] = useState(null);
  const [personalForm, setPersonalForm] = useState(buildPersonalForm(null));
  const [preferenceForm, setPreferenceForm] = useState(buildPreferenceForm(null));
  const [passwordForm, setPasswordForm] = useState(buildPasswordForm(null));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [theme, setTheme] = useState(getStoredTheme);

  const tokenKey = getTokenKey(role);

  const headers = useCallback(() => {
    const token = getValidToken(role);
    return token ? { Authorization: `Bearer ${token}` } : null;
  }, [role]);

  const syncProfile = useCallback((nextProfile) => {
    setProfile(nextProfile);
    setPersonalForm(buildPersonalForm(nextProfile));
    setPreferenceForm(buildPreferenceForm(nextProfile));
    setPasswordForm((previous) => ({
      ...previous,
      securityQuestion: nextProfile?.securityQuestion || securityQuestions[0],
    }));
  }, []);

  useEffect(() => {
    let ignore = false;

    const fetchProfile = async () => {
      const authHeaders = headers();
      if (!authHeaders) {
        clearAuthToken(role);
        navigate('/login', { replace: true });
        return;
      }

      try {
        const response = await axios.get(`${API_BASE_URL}/api/profile`, { headers: authHeaders });
        if (!ignore) {
          syncProfile(response.data.user);
          setError('');
        }
      } catch (requestError) {
        if (!ignore) {
          if ([401, 403].includes(requestError.response?.status)) {
            clearAuthToken(role);
            navigate('/login', { replace: true });
            return;
          }
          setError(requestError.response?.data?.message || 'Unable to load settings');
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    };

    fetchProfile();
    return () => {
      ignore = true;
    };
  }, [headers, navigate, role, syncProfile]);

  useEffect(() => {
    setMessage('');
    setError('');
  }, [activeSection]);

  const filteredSections = useMemo(
    () =>
      sections.filter((section) =>
        section.label.toLowerCase().includes(quickFind.trim().toLowerCase()),
      ),
    [quickFind],
  );

  const updateSection = (sectionId) => {
    setSearchParams(sectionId === 'personal' ? {} : { section: sectionId });
  };

  const handlePersonalChange = (event) => {
    const { name, value } = event.target;
    setPersonalForm((previous) => ({ ...previous, [name]: value }));
    setMessage('');
    setError('');
  };

  const handlePreferenceChange = (event) => {
    const { name, value } = event.target;
    setPreferenceForm((previous) => ({ ...previous, [name]: value }));
    setMessage('');
    setError('');
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((previous) => ({ ...previous, [name]: value }));
    setMessage('');
    setError('');
  };

  const handlePersonalSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage('');
    setError('');

    const data = new FormData();
    data.append('name', `${personalForm.firstName} ${personalForm.lastName}`.trim());
    data.append('alias', personalForm.alias);
    data.append('nickname', personalForm.nickname);
    data.append('phone', personalForm.phone);
    data.append('mobile', personalForm.mobile);
    data.append('position', personalForm.position);
    data.append('country', personalForm.country);
    data.append('street', personalForm.street);
    data.append('city', personalForm.city);
    data.append(
      'stateProvince',
      personalForm.stateProvince === '--None--' ? '' : personalForm.stateProvince,
    );
    data.append('postalCode', personalForm.postalCode);
    if (role === 'admin') data.append('email', personalForm.email);

    try {
      const response = await axios.put(`${API_BASE_URL}/api/profile`, data, {
        headers: { Authorization: `Bearer ${localStorage.getItem(tokenKey)}` },
      });
      syncProfile(response.data.user);
      setMessage(response.data.message || 'Personal information updated successfully');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update personal information');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreferenceSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await axios.put(`${API_BASE_URL}/api/profile/preferences`, preferenceForm, {
        headers: { Authorization: `Bearer ${localStorage.getItem(tokenKey)}` },
      });
      syncProfile(response.data.user);
      setMessage(response.data.message || 'Language and time zone updated successfully');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update language and time zone');
    } finally {
      setIsSaving(false);
    }
  };

  const passwordRules = {
    length: passwordForm.newPassword.length >= 8,
    letter: /[A-Za-z]/.test(passwordForm.newPassword),
    number: /\d/.test(passwordForm.newPassword),
    match: passwordForm.newPassword && passwordForm.newPassword === passwordForm.confirmPassword,
    security: passwordForm.securityAnswer.trim().length > 0,
  };

  const canSavePassword =
    passwordForm.currentPassword &&
    passwordRules.length &&
    passwordRules.letter &&
    passwordRules.number &&
    passwordRules.match &&
    passwordRules.security;

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    if (!canSavePassword) return;

    setIsSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await axios.put(
        `${API_BASE_URL}/api/profile/password`,
        {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
          securityQuestion: passwordForm.securityQuestion,
          securityAnswer: passwordForm.securityAnswer,
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem(tokenKey)}` },
        },
      );
      syncProfile(response.data.user);
      setPasswordForm(buildPasswordForm(response.data.user));
      setMessage(response.data.message || 'Password changed successfully');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to change password');
    } finally {
      setIsSaving(false);
    }
  };

  const downloadLoginHistory = () => {
    const rows = profile?.loginHistory || [];
    const headings = [
      'Login Time',
      'Source IP',
      'Login Type',
      'Login Subtype',
      'Status',
      'Application',
      'Login URL',
      'Location',
      'User Agent',
    ];
    const csvRows = [
      headings.map(escapeCsv).join(','),
      ...rows.map((row) =>
        [
          formatDateTime(row.loginTime),
          row.sourceIp,
          row.loginType,
          row.loginSubtype,
          row.status,
          row.application,
          row.loginUrl,
          row.location || 'India',
          row.userAgent,
        ]
          .map(escapeCsv)
          .join(','),
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `login-history-${profile?.email || 'user'}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const renderPersonalInformation = () => (
    <SectionPanel title="Personal Information">
      <form onSubmit={handlePersonalSubmit}>
        <div className="px-4 py-3 text-sm text-slate-600">
          CRM sends notification emails from verified domains. Keep your account details accurate
          for assignments and activity updates.
        </div>

        <Subsection title="Details">
          <div className="space-y-3">
            <FieldRow label="First Name">
              <input
                className={fieldClass}
                name="firstName"
                value={personalForm.firstName}
                onChange={handlePersonalChange}
              />
            </FieldRow>
            <FieldRow label="Last Name" required>
              <input
                className={fieldClass}
                name="lastName"
                value={personalForm.lastName}
                onChange={handlePersonalChange}
                required
              />
            </FieldRow>
            <FieldRow label="Alias" required>
              <input
                className={fieldClass}
                name="alias"
                value={personalForm.alias}
                onChange={handlePersonalChange}
                maxLength={8}
                required
              />
            </FieldRow>
            <FieldRow label="Email" required>
              <input
                className={fieldClass}
                type="email"
                name="email"
                value={personalForm.email}
                onChange={handlePersonalChange}
                disabled={role !== 'admin'}
                required
              />
            </FieldRow>
            <FieldRow label="Username">
              <input className={fieldClass} value={personalForm.username} disabled />
            </FieldRow>
            <FieldRow label="Nickname" required>
              <input
                className={fieldClass}
                name="nickname"
                value={personalForm.nickname}
                onChange={handlePersonalChange}
                required
              />
            </FieldRow>
            <FieldRow label="Phone">
              <input
                className={fieldClass}
                name="phone"
                value={personalForm.phone}
                onChange={handlePersonalChange}
              />
            </FieldRow>
            <FieldRow label="Mobile">
              <input
                className={fieldClass}
                name="mobile"
                value={personalForm.mobile}
                onChange={handlePersonalChange}
                placeholder="Example: +91 9876543210"
              />
            </FieldRow>
            <FieldRow label="Position">
              <input
                className={fieldClass}
                name="position"
                value={personalForm.position}
                onChange={handlePersonalChange}
              />
            </FieldRow>
          </div>
        </Subsection>

        <Subsection title="Address">
          <div className="space-y-3">
            <FieldRow label="Country">
              <select
                className={selectClass}
                name="country"
                value={personalForm.country}
                onChange={handlePersonalChange}
              >
                {countryOptions.map((country) => (
                  <option key={country}>{country}</option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Street">
              <textarea
                className={`${fieldClass} min-h-16 resize-y`}
                name="street"
                value={personalForm.street}
                onChange={handlePersonalChange}
              />
            </FieldRow>
            <FieldRow label="City">
              <input
                className={fieldClass}
                name="city"
                value={personalForm.city}
                onChange={handlePersonalChange}
              />
            </FieldRow>
            <FieldRow label="State/Province">
              <select
                className={selectClass}
                name="stateProvince"
                value={personalForm.stateProvince || '--None--'}
                onChange={handlePersonalChange}
              >
                {stateOptions.map((state) => (
                  <option key={state}>{state}</option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Zip/Postal Code">
              <input
                className={fieldClass}
                name="postalCode"
                value={personalForm.postalCode}
                onChange={handlePersonalChange}
              />
            </FieldRow>
          </div>
        </Subsection>

        <div className="flex items-center justify-center gap-2 bg-slate-50 px-4 py-3">
          <button
            type="button"
            onClick={() => setPersonalForm(buildPersonalForm(profile))}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || isLoading}
            className="rounded-md bg-blue-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:bg-slate-300"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </SectionPanel>
  );

  const renderAdvancedDetails = () => (
    <SectionPanel title="Advanced User Details">
      <div className="px-4 py-4">
        <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">User</p>
            <h2 className="text-2xl font-semibold text-slate-950">{profile?.name || 'User'}</h2>
            <p className="mt-2 text-sm text-slate-600">
              Advanced account information is shown here for quick review.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => updateSection('personal')}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => updateSection('password')}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
            >
              Change Password
            </button>
            <button
              type="button"
              onClick={() => updateSection('login-history')}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
            >
              View Login History
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-slate-200">
          <div className="bg-slate-200 px-3 py-2 text-sm font-bold text-slate-950">User Detail</div>
          <div className="grid gap-0 lg:grid-cols-2">
            <div className="border-r border-slate-100">
              <ReadRow label="Name" value={profile?.name} />
              <ReadRow label="Alias" value={profile?.alias || getAlias(profile)} />
              <ReadRow label="Email" value={profile?.email} />
              <ReadRow label="Username" value={profile?.email} />
              <ReadRow label="Nickname" value={profile?.nickname} />
              <ReadRow label="Title" value={profile?.position} />
              <ReadRow label="Country" value={profile?.country} />
              <ReadRow label="Time Zone" value={profile?.timezone} />
              <ReadRow label="Locale" value={profile?.locale} />
            </div>
            <div>
              <ReadRow label="Role" value={profile?.role} />
              <ReadRow
                label="User License"
                value={profile?.role === 'admin' ? 'CRM Administrator' : 'CRM Employee'}
              />
              <ReadRow
                label="Profile"
                value={profile?.role === 'admin' ? 'System Administrator' : 'Employee User'}
              />
              <ReadRow label="Active" value="Yes" />
              <ReadRow label="Language" value={profile?.language} />
              <ReadRow label="Email Encoding" value={profile?.emailEncoding} />
              <ReadRow label="Security Question" value={profile?.securityQuestion} />
              <ReadRow
                label="Security Answer Updated"
                value={formatDateTime(profile?.securityAnswerUpdatedAt)}
              />
              <ReadRow label="Last Login" value={formatDateTime(profile?.lastLoginAt)} />
              <ReadRow
                label="Password Changed"
                value={formatDateTime(profile?.passwordChangedAt)}
              />
              <ReadRow label="User ID" value={profile?.id} />
            </div>
          </div>
        </div>
      </div>
    </SectionPanel>
  );

  const renderLoginHistory = () => {
    const rows = profile?.loginHistory || [];

    return (
      <SectionPanel title="Login History">
        <div className="flex flex-col gap-3 px-4 py-3 text-sm font-medium text-slate-700 sm:flex-row sm:items-center sm:justify-between">
          <span>
            To view recent account access, review successful browser logins recorded by the CRM.
          </span>
          <button
            type="button"
            onClick={downloadLoginHistory}
            className="w-fit rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
          >
            Download CSV
          </button>
        </div>
        <div className="border-t border-slate-200 px-4 py-3">
          <div className="grid max-w-2xl grid-cols-[14rem_1fr] gap-y-2 text-sm">
            <span className="text-right font-bold text-slate-500">Last Login</span>
            <span className="pl-5 font-semibold text-slate-950">
              {formatDateTime(profile?.lastLoginAt)}
            </span>
            <span className="text-right font-bold text-slate-500">
              Last Password Change or Reset
            </span>
            <span className="pl-5 font-semibold text-slate-950">
              {formatDateTime(profile?.passwordChangedAt)}
            </span>
          </div>
        </div>
        <Subsection title="Login History">
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-[62rem] w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  {[
                    'Login Time',
                    'Source IP',
                    'Login Type',
                    'Login Subtype',
                    'Status',
                    'Application',
                    'Login URL',
                    'Location',
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="border-b border-r border-slate-200 px-3 py-2 font-bold last:border-r-0"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-3 py-8 text-center text-sm font-semibold text-slate-500"
                    >
                      Login history will appear after the next successful sign in.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id || row.loginTime} className="odd:bg-white even:bg-slate-50">
                      <td className="border-r border-slate-100 px-3 py-2 font-semibold">
                        {formatDateTime(row.loginTime)}
                      </td>
                      <td className="border-r border-slate-100 px-3 py-2">{row.sourceIp}</td>
                      <td className="border-r border-slate-100 px-3 py-2">{row.loginType}</td>
                      <td className="border-r border-slate-100 px-3 py-2">{row.loginSubtype}</td>
                      <td className="border-r border-slate-100 px-3 py-2 font-semibold text-emerald-700">
                        {row.status}
                      </td>
                      <td className="border-r border-slate-100 px-3 py-2">{row.application}</td>
                      <td className="border-r border-slate-100 px-3 py-2">{row.loginUrl}</td>
                      <td className="px-3 py-2">{row.location || 'India'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Subsection>
      </SectionPanel>
    );
  };

  const renderLanguage = () => (
    <SectionPanel title="Language & Time Zone">
      <form onSubmit={handlePreferenceSubmit}>
        <Subsection title="Settings">
          <div className="space-y-3">
            <FieldRow label="Time Zone" required>
              <select
                className={selectClass}
                name="timezone"
                value={preferenceForm.timezone}
                onChange={handlePreferenceChange}
              >
                {timezones.map((timezone) => (
                  <option key={timezone}>{timezone}</option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Locale" required>
              <select
                className={selectClass}
                name="locale"
                value={preferenceForm.locale}
                onChange={handlePreferenceChange}
              >
                {locales.map((locale) => (
                  <option key={locale}>{locale}</option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Language" required>
              <select
                className={selectClass}
                name="language"
                value={preferenceForm.language}
                onChange={handlePreferenceChange}
              >
                {languages.map((language) => (
                  <option key={language}>{language}</option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Email Encoding" required>
              <select
                className={selectClass}
                name="emailEncoding"
                value={preferenceForm.emailEncoding}
                onChange={handlePreferenceChange}
              >
                {encodings.map((encoding) => (
                  <option key={encoding}>{encoding}</option>
                ))}
              </select>
            </FieldRow>
          </div>
        </Subsection>
        <div className="flex items-center justify-center gap-2 bg-slate-50 px-4 py-3">
          <button
            type="button"
            onClick={() => setPreferenceForm(buildPreferenceForm(profile))}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || isLoading}
            className="rounded-md bg-blue-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:bg-slate-300"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </SectionPanel>
  );

  const renderPassword = () => (
    <SectionPanel title="Change My Password">
      <form
        onSubmit={handlePasswordSubmit}
        className="grid gap-8 px-5 py-5 lg:grid-cols-[minmax(0,42rem)_1fr]"
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-blue-950">
              <span className="text-red-600">*</span> Current Password
            </span>
            <PasswordInput
              className={fieldClass}
              name="currentPassword"
              value={passwordForm.currentPassword}
              onChange={handlePasswordChange}
              autoComplete="current-password"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-blue-950">
              <span className="text-red-600">*</span> New Password
            </span>
            <PasswordInput
              className={fieldClass}
              name="newPassword"
              value={passwordForm.newPassword}
              onChange={handlePasswordChange}
              autoComplete="new-password"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-blue-950">
              <span className="text-red-600">*</span> Confirm New Password
            </span>
            <PasswordInput
              className={fieldClass}
              name="confirmPassword"
              value={passwordForm.confirmPassword}
              onChange={handlePasswordChange}
              autoComplete="new-password"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-blue-950">
              <span className="text-red-600">*</span> New Security Question
            </span>
            <select
              className={selectClass}
              name="securityQuestion"
              value={passwordForm.securityQuestion}
              onChange={handlePasswordChange}
            >
              {securityQuestions.map((question) => (
                <option key={question}>{question}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-blue-950">
              <span className="text-red-600">*</span> New Answer
            </span>
            <input
              className={fieldClass}
              name="securityAnswer"
              value={passwordForm.securityAnswer}
              onChange={handlePasswordChange}
            />
          </label>

          <p className="text-xs font-semibold text-blue-950">* = required</p>
          <button
            type="submit"
            disabled={!canSavePassword || isSaving}
            className="w-full rounded-md bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <p className="text-xs text-slate-500">
            Password was last changed on {formatDateTime(profile?.passwordChangedAt)}.
          </p>
        </div>

        <div className="rounded-lg bg-slate-50 p-5">
          <p className="text-sm leading-6 text-blue-950">
            Enter a new password for{' '}
            <span className="font-bold">{profile?.email || 'your account'}</span>. Make sure to
            include at least:
          </p>
          <div className="mt-5 space-y-3 text-sm font-semibold text-blue-950">
            {[
              ['length', '8 characters'],
              ['letter', '1 letter'],
              ['number', '1 number'],
              ['match', 'Passwords match'],
              ['security', 'Security answer'],
            ].map(([key, text]) => (
              <div key={key} className="flex items-center gap-3">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${passwordRules[key] ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-400'}`}
                >
                  {passwordRules[key] && (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-3.5 w-3.5 fill-none stroke-current"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m5 12 4 4L19 6" />
                    </svg>
                  )}
                </span>
                {text}
              </div>
            ))}
          </div>
        </div>
      </form>
    </SectionPanel>
  );

  const renderAppearance = () => {
    const themeOptions = [
      {
        id: 'light',
        title: 'Light Theme',
        description: 'Clean white navigation with blue highlights.',
      },
      {
        id: 'dark',
        title: 'Dark Theme',
        description: 'Deep blue navigation with bright controls.',
      },
    ];

    return (
      <SectionPanel title="Appearance & Theme" help={false}>
        <div className="p-5 sm:p-7">
          <div className="max-w-3xl">
            <h3 className="text-base font-bold text-slate-950">Sidebar appearance</h3>
            <p className="mt-1 text-sm text-slate-500">
              Choose how the CRM navigation looks. Your preference is saved on this device.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {themeOptions.map((option) => {
                const selected = theme === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTheme(applyTheme(option.id))}
                    className={`overflow-hidden rounded-xl border-2 bg-white text-left transition ${
                      selected
                        ? 'border-blue-600 shadow-[0_0_0_3px_rgba(37,99,235,0.1)]'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="flex h-32 bg-[#f7f9fd] p-3">
                      <span
                        className={`h-full w-16 rounded-lg ${
                          option.id === 'dark' ? 'bg-[#0b3690]' : 'border bg-white'
                        }`}
                      />
                      <span className="flex-1 p-3">
                        <span className="block h-3 w-2/3 rounded bg-slate-200" />
                        <span className="mt-3 block h-12 rounded-lg border border-slate-200 bg-white" />
                        <span className="mt-2 block h-7 rounded-lg border border-slate-200 bg-white" />
                      </span>
                    </span>
                    <span className="flex items-start justify-between gap-3 border-t border-slate-200 p-4">
                      <span>
                        <span className="block text-sm font-bold text-slate-900">{option.title}</span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {option.description}
                        </span>
                      </span>
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          selected ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                        }`}
                      >
                        {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </SectionPanel>
    );
  };

  const content = {
    appearance: renderAppearance,
    personal: renderPersonalInformation,
    advanced: renderAdvancedDetails,
    password: renderPassword,
    'login-history': renderLoginHistory,
    language: renderLanguage,
  };

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
        <label className="relative block">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <input
            className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="Quick Find"
            value={quickFind}
            onChange={(event) => setQuickFind(event.target.value)}
          />
        </label>

        <nav className="mt-6 space-y-1">
          {filteredSections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => updateSection(section.id)}
              className={`flex w-full items-center gap-2 rounded-md border-l-4 px-3 py-2.5 text-left text-sm font-semibold transition ${
                activeSection === section.id
                  ? 'border-blue-600 bg-blue-100 text-blue-950'
                  : 'border-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-950'
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 shrink-0 fill-none stroke-current"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
              <span>{section.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <PageShell activeSection={activeSection}>
        <div className="space-y-3">
          <Message>{message}</Message>
          <Message type="error">{error}</Message>
          {isLoading ? (
            <SectionPanel title="Loading Settings" help={false}>
              <p className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                Loading settings...
              </p>
            </SectionPanel>
          ) : (
            content[activeSection]()
          )}
        </div>
      </PageShell>
    </div>
  );
};

export default AccountSettings;
