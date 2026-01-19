import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    // Show landing page by default, users can navigate to login/register
    throw redirect({ to: '/landingpage' })
  },
})
