import { Trophy, TrendingUp } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import type { AppUser } from '#/types'

interface RankingTableProps {
  players: AppUser[]
  isLoading?: boolean
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function getRankBadge(index: number) {
  if (index === 0) return { label: '🥇', className: 'bg-yellow-400 text-yellow-900 border-yellow-300' }
  if (index === 1) return { label: '🥈', className: 'bg-slate-300 text-slate-700 border-slate-200' }
  if (index === 2) return { label: '🥉', className: 'bg-amber-600 text-white border-amber-500' }
  return { label: `#${index + 1}`, className: 'bg-[var(--sand)] text-[var(--sea-ink)] border-[var(--line)]' }
}

export function RankingTable({ players, isLoading }: RankingTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5 text-[var(--lagoon-deep)]" />
            Ranking Geral
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-5 text-[var(--lagoon-deep)]" />
          Ranking Geral
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {players.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-[var(--sea-ink-soft)]">
            <Trophy className="size-10 opacity-40" />
            <p className="text-sm">Nenhum jogador cadastrado ainda.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {players.map((player, index) => {
              const rank = getRankBadge(index)
              const winRate =
                player.stats.matchesWon + player.stats.matchesLost > 0
                  ? Math.round(
                      (player.stats.matchesWon /
                        (player.stats.matchesWon + player.stats.matchesLost)) *
                        100,
                    )
                  : 0

              return (
                <li
                  key={player.uid}
                  className="flex items-center gap-3 px-6 py-3 hover:bg-[var(--surface)] transition-colors"
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${rank.className}`}
                  >
                    {rank.label}
                  </span>
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={player.photoURL ?? undefined} alt={player.displayName} />
                    <AvatarFallback>{getInitials(player.displayName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[var(--sea-ink)]">
                      {player.displayName}
                    </p>
                    <p className="text-xs text-[var(--sea-ink-soft)]">
                      {player.stats.tournamentsPlayed} torneios · {winRate}% vitórias
                    </p>
                  </div>
                  <Badge variant="default" className="shrink-0 tabular-nums">
                    {player.mmr} MMR
                  </Badge>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
