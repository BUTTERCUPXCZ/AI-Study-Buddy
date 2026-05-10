import { createFileRoute } from '@tanstack/react-router'
import { useAdminOverview } from '@/hooks/useAdmin'
import { StatCard } from '@/components/admin/StatCard'
import {
  Activity,
  BookOpenCheck,
  CreditCard,
  FileText,
  Users,
} from 'lucide-react'

export const Route = createFileRoute('/admin/')({
  component: OverviewPage,
})

function OverviewPage() {
  const { data, isLoading, isError } = useAdminOverview()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Top-level numbers across the application.
        </p>
      </header>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-lg border bg-card animate-pulse"
            />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load overview.
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total users"
            value={data.totalUsers}
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
          />
          <StatCard
            label="PRO subscribers"
            value={data.proUsers}
            hint={`${data.freeUsers} on FREE`}
            icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
          />
          <StatCard
            label="Active 7d"
            value={data.activeLast7Days}
            hint={`${data.activeLast30Days} in 30d`}
            icon={<Activity className="h-4 w-4 text-muted-foreground" />}
          />
          <StatCard
            label="Signups today"
            value={data.signupsToday}
          />
          <StatCard
            label="Notes total"
            value={data.totalNotes}
            icon={<FileText className="h-4 w-4 text-muted-foreground" />}
          />
          <StatCard
            label="Quizzes total"
            value={data.totalQuizzes}
            icon={<BookOpenCheck className="h-4 w-4 text-muted-foreground" />}
          />
        </div>
      )}
    </div>
  )
}
