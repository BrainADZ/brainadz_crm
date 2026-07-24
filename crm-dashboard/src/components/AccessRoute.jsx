import { useEffect, useState } from 'react';
import { getMyAccess } from '../services/accessApi';
import Forbidden from '../pages/Forbidden';
import { isSuperAdminSession } from '../utils/auth';

const AccessRoute = ({ children, moduleKey }) => {
  const superAdmin = isSuperAdminSession();
  const [state, setState] = useState({ loading: !superAdmin, allowed: superAdmin });
  useEffect(() => {
    if (superAdmin) return undefined;
    let active = true;
    getMyAccess()
      .then((access) => {
        if (active)
          setState({
            loading: false,
            allowed: access.bypass || access.visibleModules?.includes(moduleKey),
          });
      })
      .catch(() => {
        if (active) setState({ loading: false, allowed: false });
      });
    return () => {
      active = false;
    };
  }, [moduleKey, superAdmin]);
  if (state.loading) return <div className="h-72 animate-pulse rounded-2xl bg-slate-200" />;
  return state.allowed ? children : <Forbidden />;
};

export default AccessRoute;
