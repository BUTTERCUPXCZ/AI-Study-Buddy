import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { type RegisterData, type LoginData } from '../types/auth.ts';
import authService, { type AuthResponse } from '../services/AuthService';

export const useRegister = () => {
  return useMutation<AuthResponse, Error, RegisterData>({
    mutationFn: async (userData) => {
      try {
        const res = await api.post<AuthResponse>('/auth/register', userData);
        return res.data;
      } catch (error: unknown) {
        // Surface backend message (e.g. "This email already exists. Use another one.") so the UI can show it
        const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Registration failed';
        throw new Error(message);
      }
    },
  });
};

export const useLogin = () => {
  const queryClient = useQueryClient();
  
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
        // Invalidate user query to refetch user data
        queryClient.invalidateQueries({ queryKey: ['auth', 'user'] });
      }
    },
  });
};

/**
 * Hook to get current user
 */
export const useCurrentUser = (enabled = true) => {
  return useQuery({
    queryKey: ['auth', 'user'],
    queryFn: () => authService.getCurrentUser(),
    enabled: enabled && !!localStorage.getItem('access_token'),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });
};

/**
 * Hook to handle OAuth flow initiation
 */
export const useOAuthSignIn = () => {
  return useMutation<void, Error, { provider: 'google' | 'github' | 'facebook' | 'twitter' | 'azure' | 'linkedin'; mode: 'login' | 'register' }>({
    mutationFn: async ({ provider, mode }) => {
      await authService.signInWithOAuth(provider, mode);
    },
  });
};

/**
 * Hook to handle OAuth callback
 */
export const useOAuthCallback = () => {
  const queryClient = useQueryClient();
  
  return useMutation<AuthResponse, Error>({
    mutationFn: async () => {
      return await authService.handleOAuthCallback();
    },
    onSuccess: () => {
      // Invalidate user query to refetch user data
      queryClient.invalidateQueries({ queryKey: ['auth', 'user'] });
    },
  });
};

/**
 * Hook to logout
 */
export const useLogout = () => {
  const queryClient = useQueryClient();
  
  return useMutation<void, Error>({
    mutationFn: async () => {
      await authService.logout();
    },
    onSuccess: () => {
      // Clear all queries on logout
      queryClient.clear();
    },
  });
};

/**
 * Hook to request password reset
 */
export const useRequestPasswordReset = () => {
  return useMutation<void, Error, string>({
    mutationFn: async (email: string) => {
      await authService.resetPassword(email);
    },
  });
};

/**
 * Hook to verify password reset token
 */
export const useVerifyResetToken = () => {
  return useQuery({
    queryKey: ['auth', 'verify-reset-token'],
    queryFn: () => authService.verifyPasswordResetToken(),
    staleTime: 0,
    retry: false,
  });
};

/**
 * Hook to update password
 */
export const useUpdatePassword = () => {
  const queryClient = useQueryClient();
  
  return useMutation<void, Error, string>({
    mutationFn: async (newPassword: string) => {
      await authService.updatePassword(newPassword);
    },
    onSuccess: () => {
      // Clear all queries after password update
      queryClient.clear();
    },
  });
};

