// Central API configuration — reads from environment variable in production,
// falls back to localhost for development
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
