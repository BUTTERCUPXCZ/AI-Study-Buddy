import { Link, Outlet, useRouterState, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/context/AuthContextDefinition'
import { useLogout } from '@/hooks/useAuth'
import {
  Activity,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'

interface AuthedUser {
  email?: string
  fullname?: string
  role?: 'USER' | 'SUPPORT' | 'ADMIN' | 'SUPER_ADMIN'
}

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  /** Roles permitted to see the link. Server still enforces. */
  roles: AuthedUser['role'][]
}

const NAV: NavItem[] = [
  {
    to: '/admin',
    label: 'Overview',
    icon: <LayoutDashboard className="h-4 w-4" />,
    roles: ['SUPPORT', 'ADMIN', 'SUPER_ADMIN'],
  },
  {
    to: '/admin/users',
    label: 'Users',
    icon: <Users className="h-4 w-4" />,
    roles: ['SUPPORT', 'ADMIN', 'SUPER_ADMIN'],
  },
  {
    to: '/admin/server',
    label: 'Server status',
    icon: <Activity className="h-4 w-4" />,
    roles: ['SUPPORT', 'ADMIN', 'SUPER_ADMIN'],
  },
  {
    to: '/admin/audit',
    label: 'Audit log',
    icon: <FileText className="h-4 w-4" />,
    roles: ['SUPPORT', 'ADMIN', 'SUPER_ADMIN'],
  },
  {
    to: '/admin/payments',
    label: 'Payments',
    icon: <CreditCard className="h-4 w-4" />,
    roles: ['SUPPORT', 'ADMIN', 'SUPER_ADMIN'],
  },
]

export default function AdminLayout() {
  const { user } = useAuth() as { user: AuthedUser | null }
  const role = user?.role ?? 'USER'
  const { location } = useRouterState()
  const navigate = useNavigate()
  const logout = useLogout()

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 flex-col border-r bg-muted/30 p-4 gap-2">
        <div className="flex items-center gap-2 px-2 py-3 mb-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div>
            <div className="text-sm font-semibold">Admin</div>
            <div className="text-xs text-muted-foreground">{role}</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.filter((n) => n.roles.includes(role)).map((n) => {
            const active =
              n.to === '/admin'
                ? location.pathname === '/admin'
                : location.pathname.startsWith(n.to)
            return (
              <Link
                key={n.to}
                to={n.to}
                className={[
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted',
                ].join(' ')}
              >
                {n.icon}
                {n.label}
              </Link>
            )
          })}
        </nav>
        <div className="mt-auto p-2 text-xs text-muted-foreground border-t pt-3">
          <div className="font-medium truncate">{user?.fullname}</div>
          <div className="truncate">{user?.email}</div>
          <button
            onClick={() => {
              logout.mutate(undefined, {
                onSuccess: () => void navigate({ to: '/login' }),
              })
            }}
            disabled={logout.isPending}
            className="mt-2 flex items-center gap-1.5 text-destructive hover:underline disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            {logout.isPending ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
