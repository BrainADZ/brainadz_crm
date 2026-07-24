import { useState } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { Outlet } from 'react-router-dom';

const DashboardLayout = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      <div className={`min-h-screen transition-all duration-300 ${collapsed ? 'pl-16' : 'pl-56'}`}>
        <Navbar />

        <main className="w-full p-4 sm:p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
