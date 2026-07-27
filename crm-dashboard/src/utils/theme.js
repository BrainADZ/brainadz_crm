export const THEME_STORAGE_KEY = 'crmTheme';

export const getStoredTheme = () => localStorage.getItem(THEME_STORAGE_KEY) || 'light';

export const applyTheme = (theme) => {
  const nextTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  window.dispatchEvent(new CustomEvent('crm-theme-change', { detail: nextTheme }));
  return nextTheme;
};

export const initializeTheme = () => {
  document.documentElement.dataset.theme = getStoredTheme();
};
