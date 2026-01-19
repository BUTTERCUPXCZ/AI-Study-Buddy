import { supabase } from '../lib/supabaseClient';
import { api } from '../lib/api';

export interface AuthResponse {
  message: string;
  user?: {
    id: string;
    email: string;
    fullname: string;
  };
}

export interface OAuthUrlResponse {
  url: string;
  provider: string;
}

class AuthService {
  /**
   * Register a new user with email/password
   * @param email - User's email address
   * @param password - User's password
   * @param fullname - User's full name
   * @returns Authentication response with token and user data
   * @throws Error if registration fails
   */
  async register(email: string, password: string, fullname: string): Promise<AuthResponse> {
    try {
      const response = await api.post('/auth/register', {
        email,
        password,
        Fullname: fullname,
      });
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(err.response?.data?.message || 'Registration failed');
    }
  }

  /**
   * Login with email/password
   * @param email - User's email address
   * @param password - User's password
   * @returns Authentication response with user data
   * @throws Error if login fails
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await api.post('/auth/login', {
        email,
        password,
      });
      
      // Cookie is set automatically by the backend
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(err.response?.data?.message || 'Login failed');
    }
  }

  /**
   * Initiate OAuth flow
   * @param provider - OAuth provider (google, github, etc.)
   * @throws Error if OAuth initiation fails
   */
  async initiateOAuth(provider: 'google' | 'github' | 'facebook' | 'twitter' | 'azure' | 'linkedin'): Promise<void> {
    try {
      // Get OAuth URL from backend
      const response = await api.get<OAuthUrlResponse>(`/auth/oauth?provider=${provider}`);
      
      // Redirect user to OAuth provider
      window.location.href = response.data.url;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(err.response?.data?.message || 'OAuth initiation failed');
    }
  }


  /**
   * Sign in with OAuth provider using Supabase
   * @param provider - OAuth provider
   * @param mode - Whether this is a login or registration flow
   * @throws Error if OAuth sign-in fails
   */
  async signInWithOAuth(
    provider: 'google' | 'github' | 'facebook' | 'twitter' | 'azure' | 'linkedin',
    mode: 'login' | 'register' = 'login'
  ): Promise<void> {
    try {
      localStorage.setItem('oauth_mode', mode);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/supabaseCallback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      // The redirect will happen automatically
    } catch (error: unknown) {
      const err = error as { message?: string };
      throw new Error(err.message || 'OAuth sign-in failed');
    }
  }

  /**
   * Handle OAuth callback after redirect from provider
   * This should be called in your callback route
   * @returns Authentication response with user data
   * @throws Error if callback handling fails
   */
  async handleOAuthCallback(): Promise<AuthResponse> {
    try {
      // Get session from Supabase
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        throw new Error('No session found');
      }

      // Send access token to backend to sync user data and set cookie
      const response = await api.post<AuthResponse>('/auth/oauth/callback', {
        access_token: session.access_token,
      });

      // Cookie is set automatically by the backend
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(err.response?.data?.message || 'OAuth callback handling failed');
    }
  }

  /**
   * Get current authenticated user
   * @returns User data
   * @throws Error if user is not authenticated or request fails
   */
  async getCurrentUser() {
    try {
      // Cookie is sent automatically with the request
      const response = await api.get('/auth/me');
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(err.response?.data?.message || 'Failed to get current user');
    }
  }

  /**
   * Logout user and clear session
   * @throws Error if logout fails
   */
  async logout(): Promise<void> {
    try {
      // Call backend to clear cookie
      await api.post('/auth/logout');
      // Also sign out from Supabase
      await supabase.auth.signOut();
    } catch (error: unknown) {
      const err = error as { message?: string };
      throw new Error(err.message || 'Logout failed');
    }
  }

  /**
   * Check if user is authenticated by attempting to get current user
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      await this.getCurrentUser();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get OAuth mode from storage
   */
  getOAuthMode(): 'login' | 'register' {
    return (localStorage.getItem('oauth_mode') as 'login' | 'register') || 'login';
  }

  /**
   * Clear OAuth mode from storage
   */
  clearOAuthMode(): void {
    localStorage.removeItem('oauth_mode');
  }

  /**
   * Send password reset email
   * @param email - User's email address
   * @throws Error if sending reset email fails
   */
  async resetPassword(email: string): Promise<void> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/resetpassword`,
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      throw new Error(err.message || 'Failed to send reset email');
    }
  }

  /**
   * Verify password reset token
   * @returns True if the token is valid, false otherwise
   */
  async verifyPasswordResetToken(): Promise<boolean> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        return false;
      }

      // Check if we have a session and it's a password recovery session
      return !!session;
    } catch {
      return false;
    }
  }

  /**
   * Update password after reset
   * @param newPassword - New password to set
   * @throws Error if password update fails
   */
  async updatePassword(newPassword: string): Promise<void> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw new Error(error.message);
      }

      // Sign out after password reset
      await this.logout();
    } catch (error: unknown) {
      const err = error as { message?: string };
      throw new Error(err.message || 'Failed to update password');
    }
  }
}

export const authService = new AuthService();
export default authService;