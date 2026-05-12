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

// Strict shape returned by POST /auth/register. Distinct from AuthResponse so
// a Supabase config change (e.g. email-confirm disabled) can't silently slip a
// session payload through and bypass the email-verify flow.
export interface RegisterResponse {
  message: string;
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
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
      // CSRF / login-fixation defence is handled by Supabase's PKCE +
      // its own server-side state value. Adding our own `state` query
      // param would override the one Supabase issues — that's exactly
      // what produced `bad_oauth_state` on every callback.
      //
      // We keep `oauth_mode` in sessionStorage so the callback page can
      // tell whether the flow was kicked off from /login or /register
      // (used for UX copy only, no security role).
      sessionStorage.setItem('oauth_mode', mode);

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/supabaseCallback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }
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
      // PKCE flow: Supabase puts a `?code=…` on the redirect URL. The
      // SDK's auto-detection (`detectSessionInUrl: true`) tries to
      // exchange it asynchronously, which races our route handler. We
      // do the exchange explicitly so this function deterministically
      // owns the work — once it returns, the session is real.
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      if (code) {
        try {
          await supabase.auth.exchangeCodeForSession(code);
        } catch {
          // The SDK may have already exchanged it (auto-detection
          // raced and won). Falling through to getSession() picks up
          // that session.
        }
      }

      // Belt-and-braces: poll briefly in case the exchange above
      // resolved but Supabase hasn't yet flushed the session into
      // storage. Up to 8 s — generous for slow disks.
      let session: { access_token: string } | null = null;
      const startedAt = Date.now();
      while (!session && Date.now() - startedAt < 8000) {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw new Error(error.message);
        if (data.session) {
          session = data.session;
          break;
        }
        await new Promise((r) => setTimeout(r, 150));
      }

      if (!session) {
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
   * Email-link verification callback. Supabase's email-confirm link
   * lands the browser on `/supabaseCallback` with an access_token in
   * the URL hash. This method reads the resulting Supabase session and
   * forwards the token to the backend, which flips the local
   * `User.emailVerified` flag. The temporary Supabase session is then
   * signed out so the user lands on `/login` with a clean slate — they
   * still need to enter their password to actually sign in.
   */
  async handleEmailVerificationCallback(): Promise<{ message: string }> {
    try {
      // Supabase email-confirm links land on /supabaseCallback with the
      // tokens in the URL hash. The SDK's `detectSessionInUrl` exchanges
      // them asynchronously — racing the React effect that calls us.
      // Mirror handleOAuthCallback: do the exchange explicitly when the
      // hash is still there, then poll briefly so the session is
      // guaranteed-flushed before we forward the token to the backend.
      const hash = window.location.hash.startsWith('#')
        ? window.location.hash.substring(1)
        : '';
      if (hash) {
        const hashParams = new URLSearchParams(hash);
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          try {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          } catch {
            // SDK may have already consumed the hash via
            // detectSessionInUrl. Fall through to the poll below.
          }
        }
      }

      // Belt-and-braces: poll up to 8 s for getSession() to return a
      // session. Same tuning as handleOAuthCallback — generous for slow
      // disks and storage events.
      let session: { access_token: string } | null = null;
      const startedAt = Date.now();
      while (!session && Date.now() - startedAt < 8000) {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw new Error(error.message);
        if (data.session) {
          session = data.session;
          break;
        }
        await new Promise((r) => setTimeout(r, 150));
      }

      if (!session) {
        throw new Error('Email verification session never materialized');
      }

      const response = await api.post<{ message: string }>(
        '/auth/verify-email/callback',
        { access_token: session.access_token },
      );
      // One-shot — drop the Supabase session so the user has to actually
      // log in afterwards.
      try {
        await supabase.auth.signOut();
      } catch {
        // Best-effort; the cookie is already gone if Supabase complains.
      }
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      throw new Error(
        err.response?.data?.message || err.message || 'Email verification failed',
      );
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
      // Order matters: clear the backend cookie first so the session is
      // invalid even if the browser later replays Supabase tokens.
      await api.post('/auth/logout');
      await supabase.auth.signOut();
    } catch (error: unknown) {
      const err = error as { message?: string };
      throw new Error(err.message || 'Logout failed');
    } finally {
      // Always purge any client-side traces, even if a network call failed.
      try {
        sessionStorage.removeItem('oauth_state');
        sessionStorage.removeItem('oauth_mode');
        sessionStorage.removeItem('auth_user_cache');
        // Supabase persists its session in localStorage under this key.
        // Defense-in-depth: drop it here too in case signOut() couldn't.
        localStorage.removeItem('supabase-auth');
      } catch {
        // sessionStorage/localStorage may be disabled; nothing to do.
      }
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
   * Get OAuth mode from storage (sessionStorage so it doesn't survive
   * past the browser tab; closes an account-mode-confusion vector).
   */
  getOAuthMode(): 'login' | 'register' {
    return (sessionStorage.getItem('oauth_mode') as 'login' | 'register') || 'login';
  }

  clearOAuthMode(): void {
    sessionStorage.removeItem('oauth_mode');
  }

  /**
   * Legacy CSRF check for the OAuth callback. Now a no-op: Supabase's
   * PKCE + its own server-side state value already prevent CSRF /
   * login-fixation on the OAuth flow, and the previous implementation
   * was actively harmful — it wrote a custom `state` query param that
   * overrode Supabase's, producing `bad_oauth_state` on every callback.
   *
   * Kept as a function so callers don't need a coordinated change. It
   * always returns true and only cleans up any stale `oauth_state` key
   * left behind by older builds. Returns the `_returnedState` argument
   * unread so callers don't have to remove it.
   */
  verifyAndClearOAuthState(_returnedState: string | null): boolean {
    void _returnedState;
    sessionStorage.removeItem('oauth_state');
    return true;
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