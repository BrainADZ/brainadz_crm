import { Navigate } from 'react-router-dom';
import { getValidToken } from '../utils/auth';

const PrivateRoute = ({ children, role }) => {
  const token = getValidToken(role);

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default PrivateRoute;
