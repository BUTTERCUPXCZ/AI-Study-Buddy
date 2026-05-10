import { createFileRoute } from '@tanstack/react-router'
import { useAdminMetrics } from '@/hooks/useAdmin'
import { HealthIndicator } from '@/components/admin/HealthIndicator'

export const Route = createFileRoute('/admin/server')({
  component: ServerPage,
})

function ServerPage() {
  const { data, isLoading, isError } = useAdminMetrics()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Server status</h1>
        <p className="text-sm text-muted-foreground">
          Live snapshot — refreshes every 5 seconds.
        </p>
      </header>

      {isLoading && <div className="text-muted-foreground">Loading…</div>}
      {isError && <div className="text-destructive">Failed to load metrics.</div>}

      {data && (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <HealthIndicator
              ok={data.redis.ok}
              label="Redis"
              detail={data.redis.ok ? 'connected' : 'unreachable'}
            />
            <HealthIndicator
              ok={data.db.ok}
              label="Database"
              detail={
                data.db.ok ? `${data.db.latencyMs} ms ping` : 'unreachable'
              }
            />
            <HealthIndicator
              ok={true}
              label="Process"
              detail={`${formatUptime(data.uptimeSeconds)} • ${data.memory.rssMb} MB RSS`}
            />
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Queues
            </h2>
            <div className="rounded-md border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2">Queue</th>
                    <th className="px-4 py-2">Waiting</th>
                    <th className="px-4 py-2">Active</th>
                    <th className="px-4 py-2">Completed</th>
                    <th className="px-4 py-2">Failed</th>
                    <th className="px-4 py-2">Delayed</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.queues).map(([name, c]) => {
                    if ('error' in c) {
                      return (
                        <tr key={name} className="border-t">
                          <td className="px-4 py-2 font-mono text-xs">{name}</td>
                          <td colSpan={5} className="px-4 py-2 text-destructive text-xs">
                            error: {c.error}
                          </td>
                        </tr>
                      )
                    }
                    return (
                      <tr key={name} className="border-t">
                        <td className="px-4 py-2 font-mono text-xs">{name}</td>
                        <td className="px-4 py-2 tabular-nums">{c.waiting}</td>
                        <td className="px-4 py-2 tabular-nums">{c.active}</td>
                        <td className="px-4 py-2 tabular-nums">{c.completed}</td>
                        <td
                          className={[
                            'px-4 py-2 tabular-nums',
                            c.failed > 0 ? 'text-destructive font-medium' : '',
                          ].join(' ')}
                        >
                          {c.failed}
                        </td>
                        <td className="px-4 py-2 tabular-nums">{c.delayed}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat label="RSS" value={`${data.memory.rssMb} MB`} />
            <Stat
              label="Heap used"
              value={`${data.memory.heapUsedMb} / ${data.memory.heapTotalMb} MB`}
            />
            <Stat label="Snapshot took" value={`${data.generatedInMs} ms`} />
          </section>
        </>
      )}
    </div>
  )
}

function formatUptime(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 86400) return `${Math.round(s / 3600)}h`
  return `${Math.round(s / 86400)}d`
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs uppercase text-muted-foreground tracking-wide">
        {label}
      </div>
      <div className="mt-1 font-medium tabular-nums">{value}</div>
    </div>
  )
}
