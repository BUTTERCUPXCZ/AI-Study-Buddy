import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { authService } from '@/services/AuthService'
import DashboardSkeleton from '@/components/layout/DashboardSkeleton'
import webSocketService from '@/services/WebSocketService'
import { useEffect } from 'react'

const AUTH_CACHE_KEY = 'auth_user_cache'
const CACHE_DURATION = 5 * 60 * 1000

function getCachedUser(): unknown | null {
  try {
    const cached = sessionStorage.getItem(AUTH_CACHE_KEY)
    if (!cached) return null
    const parsed = JSON.parse(cached)
    if (Date.now() - parsed.timestamp > CACHE_DURATION) return null
    return parsed.data
  } catch {
    return null
  }
}

export const Route = createFileRoute('/__protected')({
  beforeLoad: async ({ location }) => {
    const cached = getCachedUser()
    if (cached) {
      return { user: cached }
    }

    try {
      const user = await authService.getCurrentUser()
      if (!user) {
        throw redirect({
          to: '/login',
          search: { redirect: location.href },
        })
      }
      return { user }
    } catch {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
  },
  component: RouteComponent,
  // Renders instantly while beforeLoad's network call to /auth/me is in
  // flight — the user sees structure immediately instead of a blank page.
  pendingComponent: DashboardSkeleton,
  // Enforce the skeleton fallback even on fast networks where TanStack
  // Router would otherwise blink straight to the route.
  pendingMs: 0,
})

function RouteComponent() {
  // One-time WS connect at the protected layer. All children become
  // pure subscribers via useJobWebSocket → no per-page handshake cost.
  useEffect(() => {
    if (!webSocketService.isConnected()) {
      webSocketService.connect()
    }
  }, [])
  return <Outlet />
}