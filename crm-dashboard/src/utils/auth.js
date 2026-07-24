const TOKEN_KEYS = {
  admin: 'adminToken',
  employee: 'employeeToken',
};

const decodeJwtPayload = (token) => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
};

export const clearAuthToken = (role) => {
  const key = TOKEN_KEYS[role];
  if (key) localStorage.removeItem(key);
};

export const clearAllAuthTokens = () => {
  Object.values(TOKEN_KEYS).forEach((key) => localStorage.removeItem(key));
};

export const isTokenValidForRole = (token, role) => {
  const payload = decodeJwtPayload(token);
  const expiryMs = payload?.exp ? payload.exp * 1000 : 0;
  const tokenRole = payload?.user?.role;

  return tokenRole === role && expiryMs > Date.now();
};

export const getValidToken = (role) => {
  const key = TOKEN_KEYS[role];
  if (!key) return null;

  const token = localStorage.getItem(key);
  if (!token) return null;

  if (isTokenValidForRole(token, role)) return token;

  localStorage.removeItem(key);
  return null;
};

export const getAuthenticatedRole = () => {
  if (getValidToken('admin')) return 'admin';
  if (getValidToken('employee')) return 'employee';
  return null;
};

export const getAuthenticatedUser = () => {
  const adminToken = getValidToken('admin');
  const employeeToken = getValidToken('employee');
  return decodeJwtPayload(adminToken || employeeToken || '')?.user || null;
};

export const isSuperAdminSession = () => {
  const user = getAuthenticatedUser();
  return (
    user?.role === 'admin' && (user?.roleKey === 'super_admin' || user?.crmRole === 'super_admin')
  );
};
