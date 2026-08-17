import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import DashboardLayout from './components/DashboardLayout';
import Clients from './pages/Clients';
import ClientDatasetDetail from './pages/ClientDatasetDetail';
import Employees from './pages/Employees';
import Login from './pages/Login';
import PrivateRoute from './components/PrivateRoute';
import AccessRoute from './components/AccessRoute';
import AdminTasks from './pages/AdminTasks';
import AdminDashboardHome from './pages/AdminDashboardHome';
import WhatsAppDemo from './pages/WhatsAppDemo';
import AccountSettings from './pages/AccountSettings';
import CommunicationHub from './pages/CommunicationHub';
import MarketingHub from './pages/MarketingHub';
import AccountingHub from './pages/AccountingHub';
import ProjectsHub from './pages/ProjectsHub';
import DocumentsHub from './pages/DocumentsHub';
import PermissionsHub from './pages/PermissionsHub';
import Meetings from './pages/Meetings';
import Quotations from './pages/Quotations';
import TeamWorkload from './pages/TeamWorkload';
import { getAuthenticatedRole } from './utils/auth';

const AppRoutes = () => {
  // Re-render the auth gates after login/logout navigation. Reading the role in
  // the outer App component left it frozen at the value from the first page load.
  useLocation();
  const authenticatedRole = getAuthenticatedRole();

  return (
    <Routes>
        {/* Default route to handle login redirection */}
        <Route
          path="/"
          element={
            authenticatedRole === 'admin' || authenticatedRole === 'employee' ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/login"
          element={
            authenticatedRole === 'admin' || authenticatedRole === 'employee' ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login />
            )
          }
        />
        <Route path="/employee-login" element={<Navigate to="/login" replace />} />

        {/* Shared CRM dashboard. The sidebar and every route are permission-gated. */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute roles={['admin', 'employee']}>
              <DashboardLayout />
            </PrivateRoute>
          }
        >
          <Route
            index
            element={
              <AccessRoute moduleKey="dashboard">
                <AdminDashboardHome />
              </AccessRoute>
            }
          />
          <Route path="business" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="clients"
            element={
              <AccessRoute moduleKey="sales">
                <Clients />
              </AccessRoute>
            }
          />
          <Route
            path="clients/:datasetId"
            element={
              <AccessRoute moduleKey="sales">
                <ClientDatasetDetail />
              </AccessRoute>
            }
          />
          <Route
            path="quotations"
            element={
              <AccessRoute moduleKey="quotations">
                <Quotations />
              </AccessRoute>
            }
          />
          <Route
            path="employees"
            element={
              <AccessRoute moduleKey="employees">
                <Employees />
              </AccessRoute>
            }
          />
          <Route path="departments" element={<Navigate to="/dashboard/permissions" replace />} />
          <Route
            path="tasks"
            element={
              <AccessRoute moduleKey="projects">
                <AdminTasks />
              </AccessRoute>
            }
          />
          <Route
            path="workload"
            element={
              <AccessRoute moduleKey="projects">
                <TeamWorkload />
              </AccessRoute>
            }
          />
          <Route
            path="meetings"
            element={
              <AccessRoute moduleKey="meetings">
                <Meetings />
              </AccessRoute>
            }
          />
          <Route
            path="communication"
            element={
              <AccessRoute moduleKey="communication">
                <CommunicationHub />
              </AccessRoute>
            }
          />
          <Route
            path="marketing"
            element={
              <AccessRoute moduleKey="marketing">
                <MarketingHub />
              </AccessRoute>
            }
          />
          <Route
            path="accounting"
            element={
              <AccessRoute moduleKey="accounting">
                <AccountingHub />
              </AccessRoute>
            }
          />
          <Route
            path="projects"
            element={
              <AccessRoute moduleKey="projects">
                <ProjectsHub />
              </AccessRoute>
            }
          />
          <Route
            path="documents"
            element={
              <AccessRoute moduleKey="documents">
                <DocumentsHub />
              </AccessRoute>
            }
          />
          <Route
            path="permissions"
            element={
              <AccessRoute moduleKey="permissions">
                <PermissionsHub />
              </AccessRoute>
            }
          />
          <Route
            path="whatsapp"
            element={
              <AccessRoute moduleKey="whatsapp">
                <WhatsAppDemo />
              </AccessRoute>
            }
          />
          <Route
            path="settings"
            element={<AccountSettings role={authenticatedRole === 'admin' ? 'admin' : 'employee'} />}
          />
          <Route path="assign-clients" element={<Navigate to="/dashboard/tasks" replace />} />
        </Route>

        {/* Legacy employee-only links now use the shared CRM dashboard. */}
        <Route path="/employee-dashboard/*" element={<Navigate to="/dashboard" replace />} />

        {/* Catch-all Route for Undefined Paths */}
        <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App = () => (
  <Router>
    <AppRoutes />
  </Router>
);

export default App;
