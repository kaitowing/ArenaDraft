import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/tournaments/$tournamentId')({
  component: () => <Outlet />,
})
