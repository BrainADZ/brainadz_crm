import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';

import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { getAuthenticatedRole } from '../utils/auth';
import { applyTheme, getStoredTheme } from '../utils/theme';

const DashboardLayout = () => {
  const [collapsed, setCollapsed] = useState(false);

  const [theme, setTheme] = useState(getStoredTheme);

  const role = getAuthenticatedRole() || 'employee';

  // Apply theme globally to the complete dashboard.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const syncTheme = (event) => setTheme(event.detail);
    window.addEventListener('crm-theme-change', syncTheme);
    return () => window.removeEventListener('crm-theme-change', syncTheme);
  }, []);

  return (
    <div
      className="app-shell min-h-screen"
      data-theme={theme}
    >
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        theme={theme}
        setTheme={setTheme}
      />

      <div
        className={`min-h-screen transition-all duration-300 ${
          collapsed ? 'pl-16' : 'pl-56'
        }`}
      >
        <Navbar
          role={role}
          theme={theme}
          setTheme={setTheme}
        />

        <main className="w-full p-4 sm:p-5 lg:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
