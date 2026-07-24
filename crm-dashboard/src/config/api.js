export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(
  /\/+$/,
  '',
);

export const getAssetUrl = (assetPath) => {
  if (!assetPath) return '';
  if (/^(https?:|data:|blob:)/i.test(assetPath)) return assetPath;

  return `${API_BASE_URL}/${String(assetPath).replace(/^\/+/, '').replace(/\\/g, '/')}`;
};
