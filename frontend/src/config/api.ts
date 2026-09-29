const rawUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || 'http://localhost:8000';

// Ensure protocol is present and remove any trailing slash
export const API_BASE_URL = (() => {
  let url = rawUrl;
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, '');
})();

