import { Link, Outlet, createRootRoute, useRouterState } from '@tanstack/react-router'
import { Home, Trophy, User } from 'lucide-react'
import { Toaster } from '#/components/ui/toaster'
import { useAuth } from '#/features/auth/useAuth'
import { signOut } from '#/features/auth/authService'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'

import '../styles.css'

export const Route = createRootRoute({
  component: RootComponent,
})

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function BottomNav() {
  const { user } = useAuth()
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  if (!user) return null

  const links = [
    { to: '/' as const, icon: Home, label: 'Ranking', exact: true },
    { to: '/tournaments' as const, icon: Trophy, label: 'Torneios', exact: false },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--line)] bg-[var(--header-bg)] backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-around px-4 py-2">
        {links.map(({ to, icon: Icon, label, exact }) => {
          const active = exact ? pathname === to : pathname.startsWith(to as string)
          return (
            <Link
              key={to as string}
              to={to}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors ${
                active
                  ? 'text-[var(--lagoon-deep)]'
                  : 'text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]'
              }`}
            >
              <Icon className={`size-5 ${active ? 'stroke-[2.5]' : 'stroke-2'}`} />
              <span className="text-[10px] font-semibold">{label}</span>
            </Link>
          )
        })}

        {/* Profile */}
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)] transition-colors cursor-pointer"
          title="Sair"
        >
          {user.photoURL ? (
            <Avatar className="h-5 w-5">
              <AvatarImage src={user.photoURL} />
              <AvatarFallback className="text-[8px]">
                {getInitials(user.displayName ?? 'U')}
              </AvatarFallback>
            </Avatar>
          ) : (
            <User className="size-5 stroke-2" />
          )}
          <span className="text-[10px] font-semibold">Sair</span>
        </button>
      </div>
    </nav>
  )
}

function RootComponent() {
  return (
    <>
      <Outlet />
      <BottomNav />
      <Toaster />
    </>
  )
}
