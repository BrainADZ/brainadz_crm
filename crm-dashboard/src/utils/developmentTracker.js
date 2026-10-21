export const isDevelopmentProject = (project) =>
  ['Development', 'Projects'].includes(project?.officeModule || 'Projects');

export const isDevelopmentTask = (task, projectIds) => {
  if (task?.officeModule === 'Development') return true;
  if (task?.officeModule && task.officeModule !== 'Projects') return false;
  const developmentTeam = ['Delivery', 'Engineering', 'Development'].includes(task?.team || '');
  if (task?.project) return projectIds.has(String(task.project)) || developmentTeam;
  return developmentTeam;
};

export const isMyTask = (task, user) => {
  const email = String(user?.email || '').toLowerCase();
  const name = String(user?.name || '')
    .trim()
    .toLowerCase();
  const userId = String(user?.id || user?._id || '');
  return Boolean(
    (email && String(task.assigneeEmail || '').toLowerCase() === email) ||
    (name &&
      String(task.assignee || '')
        .trim()
        .toLowerCase() === name) ||
    (userId && String(task.assigneeUser || '') === userId) ||
    (userId && task.assignedUserIds?.some((id) => String(id) === userId)),
  );
};
