import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { type RegisterData, type LoginData, type AuthResponse } from '../types/auth.ts';

export const useRegister = () => {
  return useMutation<AuthResponse, Error, RegisterData>({
    mutationFn: async (userData) => {
      const res = await api.post<AuthResponse>('/auth/register', userData);
      return res.data;
    },
  });
};

export const useLogin = () => {
  return useMutation<AuthResponse, Error, LoginData>({
    mutationFn: async (credentials) => {
      try {
        const res = await api.post<AuthResponse>('/auth/login', credentials);
        return res.data;
      } catch (error: unknown) {
        // Surface backend message (e.g. "Account does not exist") so the UI can show it
        const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Login failed';
        throw new Error(message);
      }
    },
    onSuccess: (data) => {
      if (data.access_token) {
        // Use a consistent key name for the stored token
        localStorage.setItem('access_token', data.access_token);
      }
    },
  });
};

