import { useState } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { Outlet } from 'react-router-dom';

const DashboardLayout = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="app-shell min-h-screen bg-[#f7f9fd] text-slate-900">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      <div className={`min-h-screen transition-all duration-300 ${collapsed ? 'pl-16' : 'pl-56'}`}>
        <Navbar />

        <main className="w-full p-4 sm:p-5 lg:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
