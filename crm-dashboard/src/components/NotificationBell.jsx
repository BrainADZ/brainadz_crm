import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { getValidToken } from '../utils/auth';
import { API_BASE_URL } from '../config/api';

const notificationTone = {
  client_assignment: 'bg-blue-50 text-blue-700',
  client_unassignment: 'bg-rose-50 text-rose-700',
  client_row_update: 'bg-violet-50 text-violet-700',
  meeting_scheduled: 'bg-emerald-50 text-emerald-700',
  general: 'bg-slate-100 text-slate-600',
};

const notificationIcon = {
  client_assignment: (
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm10-3v6m3-3h-6" />
  ),
  client_unassignment: (
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 0h5" />
  ),
  client_row_update: (
    <>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
      <path d="M8 9h8M8 13h5" />
    </>
  ),
  meeting_scheduled: (
    <>
      <path d="M8 2v4M16 2v4M3 10h18" />
      <path d="M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z" />
    </>
  ),
  general: <path d="M12 6v6l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
};

const getRelativeTime = (value) => {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(Math.floor(diffMs / 60000), 0);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const NotificationBell = ({ role }) => {
  const dropdownRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const getHeaders = useCallback(() => {
    const token = getValidToken(role);
    return token ? { Authorization: `Bearer ${token}` } : null;
  }, [role]);

  const fetchNotifications = useCallback(async () => {
    const headers = getHeaders();
    if (!headers) return;

    setIsLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/notifications`, { headers });
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unreadCount || 0);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchNotifications();
    const intervalId = window.setInterval(fetchNotifications, 30000);

    return () => window.clearInterval(intervalId);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!showDropdown) return undefined;

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const markReadLocally = (notificationId) => {
    setNotifications((previous) =>
      previous.map((notification) =>
        notification._id === notificationId
          ? { ...notification, isRead: true, readAt: new Date().toISOString() }
          : notification,
      ),
    );
    setUnreadCount((previous) => Math.max(previous - 1, 0));
  };

  const handleToggleDropdown = () => {
    setShowDropdown((visible) => !visible);
    if (!showDropdown) fetchNotifications();
  };

  const handleMarkAsRead = async (notificationId) => {
    const currentNotification = notifications.find(
      (notification) => notification._id === notificationId,
    );
    if (!currentNotification || currentNotification.isRead) return;

    markReadLocally(notificationId);

    const headers = getHeaders();
    if (!headers) return;

    try {
      await axios.patch(
        `${API_BASE_URL}/api/notifications/${notificationId}/read`,
        {},
        { headers },
      );
    } catch {
      fetchNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    const headers = getHeaders();
    if (!headers) return;

    setNotifications((previous) =>
      previous.map((notification) => ({ ...notification, isRead: true })),
    );
    setUnreadCount(0);

    try {
      await axios.patch(`${API_BASE_URL}/api/notifications/read-all`, {}, { headers });
    } catch {
      fetchNotifications();
    }
  };

  const handleClearAll = async () => {
    const headers = getHeaders();
    if (!headers) return;

    setNotifications([]);
    setUnreadCount(0);

    try {
      await axios.delete(`${API_BASE_URL}/api/notifications`, { headers });
    } catch {
      fetchNotifications();
    }
  };

  const renderNotification = (notification) => {
    const content = (
      <div
        className={`flex gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${notification.isRead ? 'bg-white' : 'bg-blue-50/60'}`}
      >
        <span
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${notificationTone[notification.type] || notificationTone.general}`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 fill-none stroke-current"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {notificationIcon[notification.type] || notificationIcon.general}
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="line-clamp-1 text-sm font-semibold text-slate-900">
              {notification.title}
            </span>
            {!notification.isRead && (
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
            )}
          </span>
          <span className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
            {notification.message}
          </span>
          <span className="mt-2 block text-[11px] font-medium text-slate-400">
            {notification.actorName} - {getRelativeTime(notification.createdAt)}
          </span>
        </span>
      </div>
    );

    if (notification.link) {
      return (
        <Link
          key={notification._id}
          to={notification.link}
          onClick={() => {
            handleMarkAsRead(notification._id);
            setShowDropdown(false);
          }}
          className="block"
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        key={notification._id}
        type="button"
        onClick={() => handleMarkAsRead(notification._id)}
        className="block w-full"
      >
        {content}
      </button>
    );
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        title="Notifications"
        onClick={handleToggleDropdown}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 fill-none stroke-current"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Zm-4.3 13a2 2 0 0 1-3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {unreadCount} unread update{unreadCount === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                >
                  Read all
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {isLoading && notifications.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                Loading notifications...
              </p>
            )}

            {!isLoading && error && (
              <p className="px-4 py-8 text-center text-sm font-semibold text-red-600">{error}</p>
            )}

            {!isLoading && !error && notifications.length === 0 && (
              <div className="px-4 py-10 text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5 fill-none stroke-current"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Zm-4.3 13a2 2 0 0 1-3.4 0" />
                  </svg>
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-700">No notifications yet</p>
                <p className="mt-1 text-xs text-slate-500">
                  New assignments, updates, and meetings will appear here.
                </p>
              </div>
            )}

            {notifications.map(renderNotification)}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
