import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/DashboardLayout';
import EmployeeLayout from './components/EmployeeLayout';
import Clients from './pages/Clients';
import ClientDatasetDetail from './pages/ClientDatasetDetail';
import Employees from './pages/Employees';
import Login from './pages/Login';
import EmployeeDashboard from './pages/EmployeeDashboard';
import EmployeeTasks from './pages/EmployeeTask';
import EmployeeDatasets from './pages/EmployeeDatasets';
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

const App = () => {
  const authenticatedRole = getAuthenticatedRole();

  return (
    <Router>
      <Routes>
        {/* Default route to handle login redirection */}
        <Route
          path="/"
          element={
            authenticatedRole === 'admin' ? (
              <Navigate to="/dashboard" replace />
            ) : authenticatedRole === 'employee' ? (
              <Navigate to="/employee-dashboard" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/login"
          element={
            authenticatedRole === 'admin' ? (
              <Navigate to="/dashboard" replace />
            ) : authenticatedRole === 'employee' ? (
              <Navigate to="/employee-dashboard" replace />
            ) : (
              <Login />
            )
          }
        />
        <Route path="/employee-login" element={<Navigate to="/login" replace />} />

        {/* Admin Dashboard Routes */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute role="admin">
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
          <Route path="settings" element={<AccountSettings role="admin" />} />
          <Route path="assign-clients" element={<Navigate to="/dashboard/tasks" replace />} />
        </Route>

        {/* Employee Dashboard Routes */}
        <Route
          path="/employee-dashboard"
          element={
            <PrivateRoute role="employee">
              <EmployeeLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<EmployeeDashboard />} />
          <Route path="tasks" element={<EmployeeTasks />} />
          <Route path="datasets" element={<EmployeeDatasets />} />
          <Route path="datasets/:datasetId" element={<ClientDatasetDetail />} />
          <Route
            path="sales"
            element={
              <AccessRoute moduleKey="sales">
                <Clients />
              </AccessRoute>
            }
          />
          <Route
            path="sales/:datasetId"
            element={
              <AccessRoute moduleKey="sales">
                <ClientDatasetDetail />
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
            path="quotations"
            element={
              <AccessRoute moduleKey="quotations">
                <Quotations />
              </AccessRoute>
            }
          />
          <Route path="settings" element={<AccountSettings role="employee" />} />
        </Route>

        {/* Catch-all Route for Undefined Paths */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
