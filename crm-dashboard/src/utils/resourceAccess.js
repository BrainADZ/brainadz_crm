export const canAccessResource = (access, resource, action = 'view') => {
  if (!access || !resource) return false;
  if (access.bypass) return true;
  return Boolean(
    access.permissions?.some(
      (permission) =>
        permission.resource === resource &&
        permission.actions?.includes(action) &&
        !permission.deniedActions?.includes(action),
    ),
  );
};
