import { createFileRoute } from '@tanstack/react-router'
import { useAdminOverview, useAdminUsers } from '@/hooks/useAdmin'
import { StatCard } from '@/components/admin/StatCard'
import { CreditCard, TrendingUp, Users, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/admin/payments')({
  component: PaymentsPage,
})

function PaymentsPage() {
  const overview = useAdminOverview()
  const proUsers = useAdminUsers({ plan: 'PRO', limit: 50 })

  const conversionRate =
    overview.data && overview.data.totalUsers > 0
      ? ((overview.data.proUsers / overview.data.totalUsers) * 100).toFixed(1)
      : '0'

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Subscription breakdown and PRO subscriber list.
        </p>
      </header>

      {/* Stats */}
      {overview.isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
      )}

      {overview.isError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load payment stats.
        </div>
      )}

      {overview.data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="PRO subscribers"
            value={overview.data.proUsers}
            icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
          />
          <StatCard
            label="FREE users"
            value={overview.data.freeUsers}
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
          />
          <StatCard
            label="Total users"
            value={overview.data.totalUsers}
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
          />
          <StatCard
            label="Conversion rate"
            value={`${conversionRate}%`}
            hint="FREE → PRO"
            icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          />
        </div>
      )}

      {/* PRO Subscriber list */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">PRO Subscribers</h2>

        {proUsers.isLoading && (
          <div className="rounded-md border bg-card divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse bg-muted/40 mx-4 my-2 rounded" />
            ))}
          </div>
        )}

        {proUsers.isError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Failed to load subscribers.
          </div>
        )}

        {proUsers.data?.items.length === 0 && (
          <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
            No PRO subscribers yet.
          </div>
        )}

        {proUsers.data && proUsers.data.items.length > 0 && (
          <div className="rounded-md border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Name</th>
                  <th className="text-left px-4 py-2 font-medium">Email</th>
                  <th className="text-left px-4 py-2 font-medium">Plan</th>
                  <th className="text-left px-4 py-2 font-medium">Verified</th>
                  <th className="text-left px-4 py-2 font-medium">Last login</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {proUsers.data.items.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{u.Fullname || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                        PRO
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {u.emailVerified ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleDateString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
