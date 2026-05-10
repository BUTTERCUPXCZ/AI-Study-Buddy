import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { type RegisterData, type LoginData } from '../types/auth.ts';
import authService, { type AuthResponse } from '../services/AuthService';

class RateLimitError extends Error {
  retryAfter: number;
  isRateLimited = true as const;
  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

function extractAuthError(error: unknown): Error {
  const errData = (error as { response?: { data?: { message?: string; isRateLimited?: boolean; retryAfter?: number } } })?.response?.data;
  const message = errData?.message || 'Request failed';

  if (errData?.isRateLimited && errData.retryAfter) {
    return new RateLimitError(message, errData.retryAfter);
  }

  return new Error(message);
}

export { RateLimitError };

export const useRegister = () => {
  return useMutation<AuthResponse, Error, RegisterData>({
    mutationFn: async (userData) => {
      try {
        const res = await api.post<AuthResponse>('/auth/register', userData);
        return res.data;
      } catch (error: unknown) {
        throw extractAuthError(error);
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
        throw extractAuthError(error);
      }
    },
    onSuccess: (data) => {
      if (data.user) {
        queryClient.setQueryData(['auth', 'user'], data.user);
      }
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      // Drop any user-scoped caches left behind by a previous session in
      // this tab. Without this, the post-login navigate to /notes can
      // hand the page a stale empty array (staleTime: 5min,
      // refetchOnMount: false) and the user sees "No study notes yet"
      // until they hard-refresh.
      queryClient.removeQueries({ queryKey: ['notes'] });
      queryClient.removeQueries({ queryKey: ['quizzes'] });
      queryClient.removeQueries({ queryKey: ['files'] });
      queryClient.removeQueries({ queryKey: ['note'] });
      queryClient.removeQueries({ queryKey: ['quiz'] });
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
    enabled: enabled,
    staleTime: 1000 * 60 * 5, // Keep data fresh for 5 minutes
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
    retry: false,
    refetchOnMount: false, // Don't refetch on every mount
    refetchOnWindowFocus: false, // Don't refetch on window focus
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
      // Same fresh-data guarantee as email/password login.
      queryClient.removeQueries({ queryKey: ['notes'] });
      queryClient.removeQueries({ queryKey: ['quizzes'] });
      queryClient.removeQueries({ queryKey: ['files'] });
      queryClient.removeQueries({ queryKey: ['note'] });
      queryClient.removeQueries({ queryKey: ['quiz'] });
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

