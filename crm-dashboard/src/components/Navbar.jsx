import { useLocation } from 'react-router-dom';
import WorkspaceTopbar from './WorkspaceTopbar';
import { isSalesSession } from '../utils/auth';

const getPageTitle = (pathname, salesSession) => {
  if (pathname === '/dashboard') return salesSession ? 'Sales Dashboard' : 'Dashboard';
  if (pathname.startsWith('/dashboard/business')) return 'Business OS';

  if (pathname.startsWith('/dashboard/clients/')) return 'Client Data';
  if (pathname.startsWith('/dashboard/clients')) return 'Clients';
  if (pathname.startsWith('/dashboard/quotations')) return 'Quotations';

  if (pathname.startsWith('/dashboard/employees')) return 'Employees';
  if (pathname.startsWith('/dashboard/tasks')) return 'Tasks';
  if (pathname.startsWith('/dashboard/workload')) return 'Team Workload';
  if (pathname.startsWith('/dashboard/meetings')) return 'Meetings';
  if (pathname.startsWith('/dashboard/communication')) return 'Communication Hub';
  if (pathname.startsWith('/dashboard/marketing')) return 'Marketing Hub';
  if (pathname.startsWith('/dashboard/accounting')) return 'Accounting';
  if (pathname.startsWith('/dashboard/projects')) return 'Projects';
  if (pathname.startsWith('/dashboard/documents')) return 'Documents';
  if (pathname.startsWith('/dashboard/permissions')) return 'Permissions';
  if (pathname.startsWith('/dashboard/whatsapp')) return 'WhatsApp Demo';
  if (pathname.startsWith('/dashboard/settings')) return 'Settings';

  return 'CRM Admin';
};

const Navbar = ({ role = 'admin' }) => {
  const location = useLocation();

  const title = getPageTitle(location.pathname, isSalesSession());

  const showSearch = !location.pathname.startsWith('/dashboard/settings');

  return <WorkspaceTopbar title={title} role={role} showSearch={showSearch} />;
};

export default Navbar;
