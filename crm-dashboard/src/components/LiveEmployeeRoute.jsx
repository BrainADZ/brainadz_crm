import { useEffect, useState } from 'react';
import { getDemoRequestAccess } from '../services/demoRequestApi';
import Forbidden from '../pages/Forbidden';

export default function LiveEmployeeRoute({ children }) {
  const [access, setAccess] = useState({ loading: true, allowed: false });

  useEffect(() => {
    let active = true;
    getDemoRequestAccess()
      .then((allowed) => {
        if (active) setAccess({ loading: false, allowed });
      })
      .catch(() => {
        if (active) setAccess({ loading: false, allowed: false });
      });
    return () => {
      active = false;
    };
  }, []);

  if (access.loading) return <div className="h-72 animate-pulse rounded-2xl bg-slate-200" />;
  return access.allowed ? children : <Forbidden />;
}
