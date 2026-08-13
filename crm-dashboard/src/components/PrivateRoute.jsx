import { Navigate } from 'react-router-dom';
import { getValidToken } from '../utils/auth';

const PrivateRoute = ({ children, role, roles }) => {
  const allowedRoles = roles || (role ? [role] : ['admin', 'employee']);
  const token = allowedRoles.map((item) => getValidToken(item)).find(Boolean);

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default PrivateRoute;
