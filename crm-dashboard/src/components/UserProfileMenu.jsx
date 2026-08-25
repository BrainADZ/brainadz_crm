import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { clearAllAuthTokens } from '../utils/auth';
import { API_BASE_URL, getAssetUrl } from '../config/api';

const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'US';

const iconClass = 'h-4 w-4 fill-none stroke-current';

const UserProfileMenu = ({ role }) => {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const tokenKey = role === 'admin' ? 'adminToken' : 'employeeToken';

  useEffect(() => {
    let ignore = false;

    const fetchProfile = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/profile`, {
          headers: { Authorization: `Bearer ${localStorage.getItem(tokenKey)}` },
        });

        if (!ignore) setProfile(response.data.user);
      } catch (requestError) {
        if (!ignore && [401, 403].includes(requestError.response?.status)) {
          clearAllAuthTokens();
          localStorage.removeItem('currentUser');
          navigate('/login', { replace: true });
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    };

    fetchProfile();
    return () => {
      ignore = true;
    };
  }, [navigate, role, tokenKey]);

  useEffect(() => {
    if (!isDropdownOpen) return undefined;

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsDropdownOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

  const handleSignOut = () => {
    setIsDropdownOpen(false);
    clearAllAuthTokens();
    localStorage.removeItem('currentUser');
    navigate('/login', { replace: true });
  };

  const openSettings = () => {
    setIsDropdownOpen(false);
    navigate('/dashboard/settings');
  };

  const avatarUrl = getAssetUrl(profile?.imageUrl);
  const displayName = profile?.name || (isLoading ? 'Loading profile...' : 'User');
  const displayEmail = profile?.email || 'No email available';
  const displayRole = profile?.role || role;

  const avatarMarkup = (sizeClass = 'h-10 w-10', textClass = 'text-sm') => (
    <span
      className={`profile-avatar flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white shadow-sm ring-2`}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={profile?.name || 'Profile'}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className={textClass}>{getInitials(profile?.name)}</span>
      )}
    </span>
  );

  return (
    <div ref={dropdownRef} className="relative font-sans">
      <button
        type="button"
        title="Open profile menu"
        aria-haspopup="menu"
        aria-expanded={isDropdownOpen}
        onClick={() => setIsDropdownOpen((visible) => !visible)}
        className="profile-trigger ml-1 flex h-10 w-10 items-center justify-center rounded-full p-0.5 text-sm font-bold text-white shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2"
      >
        {avatarMarkup('h-9 w-9', 'text-xs')}
      </button>

      {isDropdownOpen && (
        <div className="profile-menu absolute right-0 top-12 z-50 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border shadow-2xl shadow-slate-900/10">
          <span className="profile-menu-arrow absolute right-5 top-[-7px] h-3.5 w-3.5 rotate-45 border-l border-t" />

          <div className="profile-menu-header relative px-4 pb-4 pt-4">
            <div className="flex items-center gap-3">
              {avatarMarkup('h-12 w-12', 'text-base')}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-950">{displayName}</p>
                <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{displayEmail}</p>
                <span className="profile-role-badge mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold capitalize">
                  {displayRole} account
                </span>
              </div>
            </div>
          </div>

          <div className="p-2">
            <button
              type="button"
              role="menuitem"
              onClick={openSettings}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <svg
                  viewBox="0 0 24 24"
                  className={iconClass}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
                </svg>
              </span>
              <span>
                <span className="block">Settings</span>
                <span className="mt-0.5 block text-xs font-medium text-slate-400">
                  Profile, security and login details
                </span>
              </span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-500">
                <svg
                  viewBox="0 0 24 24"
                  className={iconClass}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="m16 17 5-5-5-5m5 5H9" />
                </svg>
              </span>
              <span>
                <span className="block">Log out</span>
                <span className="mt-0.5 block text-xs font-medium text-red-400">
                  End this session
                </span>
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfileMenu;
