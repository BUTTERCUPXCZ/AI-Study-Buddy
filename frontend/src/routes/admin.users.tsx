import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useAdminUsers } from '@/hooks/useAdmin'
import type { AdminUser } from '@/services/AdminService'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/admin/users')({
  component: UsersPage,
})

function UsersPage() {
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const { data, isLoading, isError } = useAdminUsers({ q, cursor, limit: 25 })

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground">
            Search, sort and manage user accounts.
          </p>
        </div>
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setCursor(undefined)
          }}
          placeholder="Search email or name..."
          className="max-w-xs"
        />
      </header>

      <div className="rounded-md border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Plan</th>
              <th className="px-4 py-2">Verified</th>
              <th className="px-4 py-2">Last login</th>
              <th className="px-4 py-2 text-right" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  Loading users…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-destructive">
                  Failed to load users.
                </td>
              </tr>
            )}
            {data?.items.map((u: AdminUser) => (
              <tr key={u.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-2 font-medium">{u.email}</td>
                <td className="px-4 py-2">{u.Fullname}</td>
                <td className="px-4 py-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-muted">
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-2">{u.subscriptionStatus}</td>
                <td className="px-4 py-2">
                  {u.emailVerified ? '✓' : <span className="text-amber-600">no</span>}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {u.lastLoginAt
                    ? new Date(u.lastLoginAt).toLocaleString()
                    : '—'}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    to="/admin/users/$userId"
                    params={{ userId: u.id }}
                    className="text-primary text-xs hover:underline"
                  >
                    open
                  </Link>
                </td>
              </tr>
            ))}
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  No users match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data?.nextCursor && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => setCursor(data.nextCursor!)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}
