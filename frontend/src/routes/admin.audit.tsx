import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useAdminAudit } from '@/hooks/useAdmin'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/admin/audit')({
  component: AuditPage,
})

function AuditPage() {
  const [action, setAction] = useState('')
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const { data, isLoading, isError } = useAdminAudit({
    cursor,
    limit: 50,
    action: action || undefined,
  })

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit log</h1>
          <p className="text-sm text-muted-foreground">
            Security-sensitive actions across the app.
          </p>
        </div>
        <Input
          value={action}
          onChange={(e) => {
            setAction(e.target.value)
            setCursor(undefined)
          }}
          placeholder="Filter by action..."
          className="max-w-xs"
        />
      </header>

      <div className="rounded-md border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Target</th>
              <th className="px-4 py-2">IP</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-destructive">
                  Failed to load audit log.
                </td>
              </tr>
            )}
            {data?.items.map((row) => (
              <tr key={row.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                  {new Date(row.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-2 font-mono text-xs">{row.action}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {row.userId ?? '—'}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {row.target ?? '—'}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {row.ip ?? '—'}
                </td>
              </tr>
            ))}
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No entries.
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
