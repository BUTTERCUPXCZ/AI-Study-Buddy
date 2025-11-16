import axios from 'axios';

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
    if (error.response?.status === 401) {
      // Clear invalid tokens
      localStorage.removeItem('access_token');
      localStorage.removeItem('token');
      // Don't auto-redirect here - let the route guard handle it
    }
    return Promise.reject(error);
  }
);
