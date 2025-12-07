import axios from 'axios';
import { showToast } from './toast'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000', // NestJS base URL
  withCredentials: true, // enable if using cookies
});

api.interceptors.request.use((config) => {
  // We store the backend access token under `access_token` when logging in.
  // Keep backward compatibility with any `token` key as well.
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If we get a 401 Unauthorized, the token may be expired
    const status = error.response?.status

    // Detect Gemini/free-tier rate limit or generic 429
    const raw = (error.response?.data?.message || error.response?.data || error.message || '').toString()
    const isGeminiLimit = status === 429 || (/gemini/i.test(raw) && /limit|rate limit|too many requests|429|free tier/i.test(raw))
    if (isGeminiLimit) {
      try {
        showToast('Gemini free tier limit reached — please try again later.', 'error')
      } catch {
        // ignore
      }
    }

    if (status === 401) {
      // Clear invalid tokens
      localStorage.removeItem('access_token');
      localStorage.removeItem('token');
      // Don't auto-redirect here - let the route guard handle it
    }
    return Promise.reject(error);
  }
);
