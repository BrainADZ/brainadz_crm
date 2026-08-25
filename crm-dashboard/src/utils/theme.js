export const THEME_STORAGE_KEY = 'dashboard-theme';

export const getStoredTheme = () => {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const legacyTheme = localStorage.getItem('crmTheme');
  return storedTheme || legacyTheme || 'light';
};

export const applyTheme = (theme) => {
  const nextTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = nextTheme;
  document.body?.setAttribute('data-theme', nextTheme);
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  window.dispatchEvent(new CustomEvent('crm-theme-change', { detail: nextTheme }));
  return nextTheme;
};

export const initializeTheme = () => {
  document.documentElement.dataset.theme = getStoredTheme();
};
