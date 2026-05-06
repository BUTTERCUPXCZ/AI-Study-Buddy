import { createFileRoute, Link } from '@tanstack/react-router'
import { useAdminUser, useSetUserRole } from '@/hooks/useAdmin'
import { useAuth } from '@/context/AuthContextDefinition'
import { Button } from '@/components/ui/button'
import type { AdminUser } from '@/services/AdminService'
import { useState } from 'react'

export const Route = createFileRoute('/admin/users/$userId')({
  component: UserDetailPage,
})

const ROLES: AdminUser['role'][] = ['USER', 'SUPPORT', 'ADMIN', 'SUPER_ADMIN']

function UserDetailPage() {
  const { userId } = Route.useParams()
  const { user: actor } = useAuth() as {
    user: { role?: AdminUser['role'] } | null
  }
  const { data, isLoading, isError } = useAdminUser(userId)
  const setRole = useSetUserRole()
  const [pendingRole, setPendingRole] = useState<AdminUser['role'] | null>(
    null,
  )

  const canPromote = actor?.role === 'SUPER_ADMIN'

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>
  if (isError || !data)
    return <div className="text-destructive">User not found.</div>

  const counts = (data as unknown as { _count: Record<string, number> })._count

  return (
    <div className="space-y-6">
      <header>
        <Link
          to="/admin/users"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Users
        </Link>
        <h1 className="text-2xl font-bold mt-1">{data.Fullname}</h1>
        <p className="text-sm text-muted-foreground">{data.email}</p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Field label="Role" value={data.role} />
        <Field label="Plan" value={data.subscriptionStatus} />
        <Field
          label="Verified"
          value={data.emailVerified ? 'yes' : 'no'}
        />
        <Field
          label="Last login"
          value={
            data.lastLoginAt
              ? new Date(data.lastLoginAt).toLocaleString()
              : '—'
          }
        />
        <Field label="Notes" value={String(counts?.notes ?? 0)} />
        <Field label="Quizzes" value={String(counts?.quizzes ?? 0)} />
        <Field label="Files" value={String(counts?.files ?? 0)} />
        <Field label="Jobs" value={String(counts?.jobs ?? 0)} />
      </div>

      {canPromote && (
        <div className="rounded-md border bg-card p-4 space-y-3">
          <div className="text-sm font-medium">Change role</div>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <Button
                key={r}
                size="sm"
                variant={r === data.role ? 'default' : 'outline'}
                disabled={setRole.isPending && pendingRole === r}
                onClick={() => {
                  setPendingRole(r)
                  setRole.mutate(
                    { id: data.id, role: r },
                    { onSettled: () => setPendingRole(null) },
                  )
                }}
              >
                {r}
              </Button>
            ))}
          </div>
          {setRole.isError && (
            <div className="text-xs text-destructive">
              Failed to change role.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs uppercase text-muted-foreground tracking-wide">
        {label}
      </div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  )
}
