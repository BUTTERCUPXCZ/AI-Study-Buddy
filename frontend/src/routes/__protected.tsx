import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { api } from '@/lib/api'

// Cache for auth check to avoid repeated API calls during navigation
let authCache: { user: any; timestamp: number } | null = null
const AUTH_CACHE_DURATION = 30000 // 30 seconds - aggressive caching for smooth navigation

export const Route = createFileRoute('/__protected')({
  beforeLoad: async ({ location }) => {
    // Check if we have a valid cached auth state
    if (authCache && Date.now() - authCache.timestamp < AUTH_CACHE_DURATION) {
      return { user: authCache.user }
    }

    // Check authentication by calling the backend /auth/me endpoint
    // The HTTP-only cookie will be sent automatically with the request
    try {
      const response = await api.get('/auth/me')
      
      if (response.data) {
        // User is authenticated via cookie - cache the result
        authCache = {
          user: response.data,
          timestamp: Date.now()
        }
        return { user: response.data }
      }
      
      // No valid user data - clear cache
      authCache = null
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        }
      })
    } catch (error) {
      // Authentication failed - clear cache and redirect to login
      authCache = null
      console.error('[Auth] Authentication check failed:', error);
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        }
      })
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  return <Outlet />
}

// Export function to clear auth cache (useful for logout)
export const clearAuthCache = () => {
  authCache = null
}
