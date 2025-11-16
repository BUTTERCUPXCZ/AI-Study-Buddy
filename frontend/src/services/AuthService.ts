import { supabase } from '../lib/supabaseClient';
import { api } from '../lib/api';

export interface AuthResponse {
  message: string;
  access_token?: string;
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
   */
  async register(email: string, password: string, fullname: string): Promise<AuthResponse> {
    try {
      const response = await api.post('/auth/register', {
        email,
        password,
        Fullname: fullname,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Registration failed');
    }
  }

  /**
   * Login with email/password
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await api.post('/auth/login', {
        email,
        password,
      });
      
      if (response.data.access_token) {
        localStorage.setItem('access_token', response.data.access_token);
      }
      
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  }

  /**
   * Initiate OAuth flow
   * @param provider - OAuth provider (google, github, etc.)
   */
  async initiateOAuth(provider: 'google' | 'github' | 'facebook' | 'twitter' | 'azure' | 'linkedin'): Promise<void> {
    try {
      // Get OAuth URL from backend
      const response = await api.get<OAuthUrlResponse>(`/auth/oauth?provider=${provider}`);
      
      // Redirect user to OAuth provider
      window.location.href = response.data.url;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'OAuth initiation failed');
    }
  }


  async signInWithOAuth(
    provider: 'google' | 'github' | 'facebook' | 'twitter' | 'azure' | 'linkedin',
    mode: 'login' | 'register' = 'login'
  ): Promise<void> {
    try {
    
      localStorage.setItem('oauth_mode', mode);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
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
    } catch (error: any) {
      throw new Error(error.message || 'OAuth sign-in failed');
    }
  }

  /**
   * Handle OAuth callback after redirect from provider
   * This should be called in your callback route
   */
  async handleOAuthCallback(): Promise<AuthResponse> {
    try {
      // Get session from Supabase
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        throw new Error('No session found');
      }

      // Send access token to backend to sync user data
      const response = await api.post<AuthResponse>('/auth/oauth/callback', {
        access_token: session.access_token,
      });

      // Store token
      localStorage.setItem('access_token', session.access_token);

      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'OAuth callback handling failed');
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser() {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('No access token found');
      }

      const response = await api.get('/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to get current user');
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('access_token');
    } catch (error: any) {
      throw new Error(error.message || 'Logout failed');
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem('access_token');
  }

  /**
   * Get stored access token
   */
  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  /**
   * Get the OAuth mode (login or register)
   */
  getOAuthMode(): 'login' | 'register' {
    const mode = localStorage.getItem('oauth_mode');
    return mode === 'register' ? 'register' : 'login';
  }

  /**
   * Clear the OAuth mode from storage
   */
  clearOAuthMode(): void {
    localStorage.removeItem('oauth_mode');
  }
}

export const authService = new AuthService();
export default authService;