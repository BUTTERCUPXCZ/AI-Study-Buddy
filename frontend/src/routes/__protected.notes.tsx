import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/__protected/notes')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Outlet />
}
