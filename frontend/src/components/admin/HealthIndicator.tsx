interface Props {
  ok: boolean
  label: string
  detail?: string
}

export function HealthIndicator({ ok, label, detail }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-card px-3 py-2">
      <span
        className={[
          'inline-block h-2.5 w-2.5 rounded-full',
          ok ? 'bg-emerald-500' : 'bg-red-500',
        ].join(' ')}
        aria-hidden
      />
      <div className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {detail && (
          <span className="text-xs text-muted-foreground">{detail}</span>
        )}
      </div>
    </div>
  )
}
