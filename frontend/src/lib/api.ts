import axios from 'axios';
import { showToast } from './toast';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  withCredentials: true,
});

const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/oauth', '/auth/resend-verification'];
function isAuthRequest(url?: string): boolean {
  if (!url) return false;
  return AUTH_PATHS.some((p) => url.includes(p));
}

// S11 — read the csrf_token cookie set by the backend's /auth/me handler
// and echo it as X-CSRF-Token on every state-changing request. Backend
// middleware enforces a timing-safe match. An attacker on a different
// origin can't read the cookie (CORS prevents it), so they can't
// reproduce the header even with a valid auth cookie.
const SAFE_METHODS = new Set(['get', 'head', 'options']);
function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(name + '='));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : undefined;
}

api.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toLowerCase();
  if (!SAFE_METHODS.has(method)) {
    const token = readCookie('csrf_token');
    if (token) {
      config.headers = config.headers ?? {};
      // axios v1 typings accept string assignment here.
      (config.headers as Record<string, string>)['X-CSRF-Token'] = token;
    }
  }
  return config;
});

const USER_SAFE_STATUSES = new Set([400, 422, 429]);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status: number | undefined = error.response?.status;
    const serverMessage = (error.response?.data?.message || '').toString();
    const url: string | undefined = error.config?.url;

    if (status === 429 && isAuthRequest(url)) {
      const retryAfter = error.response?.data?.retryAfter;
      const retrySeconds = retryAfter ? Number(retryAfter) : 60;
      error.response.data = {
        message: `Too many attempts. Please try again in ${retrySeconds} seconds.`,
        isRateLimited: true,
        retryAfter: retrySeconds,
      };
      return Promise.reject(error);
    }

    const isGeminiLimit =
      status === 429 ||
      (/gemini/i.test(serverMessage) &&
        /limit|rate limit|too many requests|429|free tier/i.test(serverMessage));
    if (isGeminiLimit) {
      showToast('Gemini free tier limit reached — please try again later.', 'error');
    }

    if (status === 401) {
      const currentPath = window.location.pathname;
      if (currentPath !== '/login') {
        try {
          window.location.replace('/login');
        } catch {
          // ignore
        }
      }
    } else if (status && status >= 500) {
      showToast('Something went wrong. Please try again.', 'error');
    }

    if (status !== undefined && !USER_SAFE_STATUSES.has(status) && status < 500) {
      if (status !== 401 && error.response?.data) {
        error.response.data = { message: 'Request failed' };
      }
    }

    return Promise.reject(error);
  },
);
