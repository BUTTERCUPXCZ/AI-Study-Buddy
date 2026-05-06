import type { ReactNode } from 'react'

interface Props {
  label: string
  value: string | number
  hint?: string
  icon?: ReactNode
}

export function StatCard({ label, value, hint, icon }: Props) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase text-muted-foreground tracking-wide">
          {label}
        </span>
        {icon}
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  )
}
