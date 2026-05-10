import { createFileRoute, redirect } from '@tanstack/react-router'
import { authService } from '@/services/AuthService'
import AdminLayout from '@/components/admin/AdminLayout'

interface MeResponse {
  id?: string
  role?: 'USER' | 'SUPPORT' | 'ADMIN' | 'SUPER_ADMIN'
}

const ADMIN_ROLES: Array<NonNullable<MeResponse['role']>> = [
  'SUPPORT',
  'ADMIN',
  'SUPER_ADMIN',
]

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ location }) => {
    let me: MeResponse | null = null
    try {
      me = (await authService.getCurrentUser()) as MeResponse
    } catch {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
    if (!me?.id) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    if (!me.role || !ADMIN_ROLES.includes(me.role)) {
      // Authenticated but not staff. Send back to user-facing app.
      throw redirect({ to: '/library' })
    }
    return { user: me }
  },
  component: AdminLayout,
})
