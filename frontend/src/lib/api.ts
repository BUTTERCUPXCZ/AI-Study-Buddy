import axios from 'axios';
import { showToast } from './toast'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000', // NestJS base URL
  withCredentials: true, // Enable sending cookies with requests
});

// Add response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If we get a 401 Unauthorized, the cookie may be expired
    const status = error.response?.status

    // Detect Gemini/free-tier rate limit or generic 429
    const raw = (error.response?.data?.message || error.response?.data || error.message || '').toString()
    const isGeminiLimit = status === 429 || (/gemini/i.test(raw) && /limit|rate limit|too many requests|429|free tier/i.test(raw))
    if (isGeminiLimit) {
      showToast('Gemini free tier limit reached — please try again later.', 'error')
    }

    if (status === 401) {
      // Redirect to login so the user can re-authenticate
      const currentPath = window.location.pathname
      if (currentPath !== '/login') {
        try {
          // use replace to avoid keeping the current (invalid) route in history
          window.location.replace('/login')
        } catch {
          // ignore redirect errors
        }
      }
    }
    return Promise.reject(error);
  }
);
