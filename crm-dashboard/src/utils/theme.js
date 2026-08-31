// Use a versioned key so installations that previously opened in dark mode
// start from the new light default once. Any choice made after this migration
// is still remembered on the device.
export const THEME_STORAGE_KEY = 'dashboard-theme-v2';

const normalizeTheme = (theme) => (theme === 'dark' ? 'dark' : 'light');

const updateDocumentTheme = (theme) => {
  const nextTheme = normalizeTheme(theme);
  document.documentElement.dataset.theme = nextTheme;
  document.body?.setAttribute('data-theme', nextTheme);
  return nextTheme;
};

export const getStoredTheme = () => normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY));

export const applyTheme = (theme) => {
  const nextTheme = updateDocumentTheme(theme);
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  window.dispatchEvent(new CustomEvent('crm-theme-change', { detail: nextTheme }));
  return nextTheme;
};

export const initializeTheme = () => {
  updateDocumentTheme(getStoredTheme());
};
