import { Skeleton } from '@/components/ui/skeleton'

/**
 * Renders instantly while `__protected.tsx`'s beforeLoad resolves the
 * authenticated user. Only paints the **content** placeholder — the
 * real sidebar + navbar are owned by AppLayout inside each child
 * route, so we deliberately leave that area blank to avoid a
 * double-layout flash when the real shell mounts.
 */
export default function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 max-w-6xl mx-auto">
        {/* Title row */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>

        {/* Content cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
      </div>
    </div>
  )
}
