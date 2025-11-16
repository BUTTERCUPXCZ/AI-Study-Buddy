import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    // Redirect to dashboard by default
    throw redirect({ to: '/dashboard' })
  },
})
