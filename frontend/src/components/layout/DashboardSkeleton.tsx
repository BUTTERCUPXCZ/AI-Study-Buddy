import { Skeleton } from '@/components/ui/skeleton'

/**
 * Renders instantly while `__protected.tsx`'s beforeLoad resolves the
 * authenticated user. Mirrors the actual dashboard structure (sidebar +
 * topbar + content grid) so the layout doesn't shift when the real
 * content swaps in.
 */
export default function DashboardSkeleton() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar shell */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-muted/30 p-4 gap-4">
        <Skeleton className="h-8 w-32" />
        <div className="flex flex-col gap-2 mt-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="mt-auto">
          <Skeleton className="h-12 w-full" />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        <header className="flex h-16 items-center justify-between border-b px-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </header>
        <div className="p-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border bg-card p-4 flex flex-col gap-3"
            >
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <div className="flex items-center justify-between mt-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
