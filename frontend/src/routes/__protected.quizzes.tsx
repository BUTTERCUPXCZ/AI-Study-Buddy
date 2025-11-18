import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/__protected/quizzes')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Outlet />
}
