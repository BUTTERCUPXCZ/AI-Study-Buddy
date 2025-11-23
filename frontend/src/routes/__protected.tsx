import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { supabase } from '@/lib/supabaseClient'

export const Route = createFileRoute('/__protected')({
  beforeLoad: async ({ location }) => {
    // Check for backend token first (email/password login)
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    
    if (token) {
      // User is authenticated via backend token
      return { session: { access_token: token } };
    }
    
    // Fallback to Supabase session check (OAuth login)
    try {
      const {
        data: { session },
        error
      } = await supabase.auth.getSession()

      if (error) {
        console.error('[Auth] Supabase session error:', error);
        throw redirect({
          to: '/login',
          search: {
            redirect: location.href,
          }
        })
      }

      if (session && session.access_token) {
        // Store the Supabase token for future use
        localStorage.setItem('access_token', session.access_token);
        return { session }
      }
    } catch (error) {
      if ((error as { to?: string }).to === '/login') {
        // This is our redirect, re-throw it
        throw error;
      }
      console.error('[Auth] Error checking session:', error);
    }

    // No valid authentication found
    throw redirect({
      to: '/login',
      search: {
        redirect: location.href,
      }
    })
  },
  component: RouteComponent,
})

function RouteComponent() {
  return <Outlet />
}
