import { Check, UserPlus } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Skeleton } from '#/components/ui/skeleton'
import { cn } from '#/lib/utils'
import { useTournamentStore } from '#/store/tournamentStore'
import type { AppUser } from '#/types'

interface PlayerSelectorProps {
  players: AppUser[]
  isLoading?: boolean
  currentUserId?: string
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function PlayerSelector({ players, isLoading, currentUserId }: PlayerSelectorProps) {
  const { selectedPlayers, togglePlayer } = useTournamentStore()
  const selectedUids = new Set(selectedPlayers.map((p) => p.uid))

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-[var(--sea-ink-soft)]">
        <UserPlus className="size-10 opacity-40" />
        <p className="text-sm text-center">Nenhum jogador cadastrado ainda.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {players.map((player) => {
        const selected = selectedUids.has(player.uid)
        const isMe = player.uid === currentUserId

        return (
          <button
            key={player.uid}
            type="button"
            onClick={() => togglePlayer(player)}
            className={cn(
              'relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-all cursor-pointer',
              selected
                ? 'border-[var(--lagoon-deep)] bg-[var(--foam)] shadow-md'
                : 'border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-strong)]',
            )}
          >
            {selected && (
              <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--lagoon-deep)] text-white">
                <Check className="size-3" />
              </span>
            )}
            <Avatar className="h-12 w-12">
              <AvatarImage src={player.photoURL ?? undefined} />
              <AvatarFallback>{getInitials(player.displayName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 w-full">
              <p className="truncate text-sm font-semibold text-[var(--sea-ink)]">
                {player.displayName}
                {isMe && ' (você)'}
              </p>
              <Badge variant="secondary" className="mt-1 text-xs">
                {player.mmr} MMR
              </Badge>
            </div>
          </button>
        )
      })}
    </div>
  )
}
