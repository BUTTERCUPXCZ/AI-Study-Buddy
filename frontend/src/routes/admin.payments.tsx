import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/payments')({
  component: PaymentsPage,
})

function PaymentsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Recent Stripe charges and subscription state.
        </p>
      </header>
      <div className="rounded-md border bg-card p-8 text-center text-muted-foreground text-sm">
        Coming in Phase 2 — wires up Stripe live data + 60s Redis cache.
      </div>
    </div>
  )
}
