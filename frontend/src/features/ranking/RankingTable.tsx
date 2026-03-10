import { Link } from '@tanstack/react-router'
import { Trophy, TrendingUp, Waves, User } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Skeleton } from '#/components/ui/skeleton'
import type { AppUser } from '#/types'

const MAX_VISIBLE = 20

interface RankingTableProps {
  players: AppUser[]
  allPlayers?: AppUser[]
  currentUserId?: string
  isLoading?: boolean
  searchTerm?: string
  totalPlayers?: number
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

const medalTokens = [
  { bg: 'bg-[var(--badge-gold)] text-[#5f4200]', label: '1º' },
  { bg: 'bg-[var(--badge-silver)] text-[#3c4e58]', label: '2º' },
  { bg: 'bg-[var(--badge-bronze)] text-white', label: '3º' },
]

function getRankBadge(index: number) {
  if (index < medalTokens.length) {
    return {
      label: medalTokens[index].label,
      className: `${medalTokens[index].bg} border-transparent shadow-sm`,
    }
  }

  return {
    label: `#${index + 1}`,
    className: 'bg-[var(--shell)] text-[var(--text-body)] border-[var(--wave-line)]',
  }
}

function PlayerRow({ player, index, isCurrentUser = false }: { player: AppUser; index: number; isCurrentUser?: boolean }) {
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
    <li>
      <Link
        to="/players/$userId"
        params={{ userId: player.uid }}
        className={`flex items-center gap-3 px-1 py-3 rounded-xl transition-colors hover:bg-[color-mix(in_oklab,var(--shell)_70%,transparent)] cursor-pointer ${
          isCurrentUser ? 'bg-[color-mix(in_oklab,var(--cta-primary)_8%,transparent)]' : ''
        }`}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${rank.className}`}
        >
          {rank.label}
        </span>
        <Avatar className="h-11 w-11 shrink-0 border border-white/40 shadow-sm">
          <AvatarImage src={player.photoURL ?? undefined} alt={player.displayName} />
          <AvatarFallback>{getInitials(player.displayName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-[var(--text-heading)]">
            {player.displayName}
            {isCurrentUser && <span className="ml-1.5 text-[10px] font-medium text-[var(--cta-primary)]">(você)</span>}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {player.stats.tournamentsPlayed} torneios · {winRate}% vitórias
          </p>
        </div>
        <div className="text-right text-sm font-semibold text-[var(--text-heading)]">
          <p className="tabular-nums">{player.mmr} MMR</p>
          <p className="text-[10px] text-[var(--text-muted)]">+{Math.max(0, player.stats.matchesWon - player.stats.matchesLost)}</p>
        </div>
      </Link>
    </li>
  )
}

export function RankingTable({ players, allPlayers, currentUserId, isLoading, searchTerm = '', totalPlayers }: RankingTableProps) {
  if (isLoading) {
    return (
      <div className="surf-card texture-noise rounded-3xl p-5">
        <div className="mb-4 flex items-center gap-2 text-[var(--text-heading)]">
          <TrendingUp className="size-5 text-[var(--cta-primary)]" />
          <div>
            <p className="sport-label text-xs text-[var(--text-muted)]">Ranking Geral</p>
            <h3 className="text-lg font-bold">Carregando areia...</h3>
          </div>
        </div>
        <div className="space-y-3">
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
        </div>
      </div>
    )
  }

  const trimmedSearchTerm = searchTerm.trim()
  const isSearching = trimmedSearchTerm.length > 0
  const rankingSource = allPlayers ?? players
  const visiblePlayers = isSearching ? players : players.slice(0, MAX_VISIBLE)
  const currentUserIndex = currentUserId ? rankingSource.findIndex((p) => p.uid === currentUserId) : -1
  const currentUserOutside = !isSearching && currentUserIndex >= MAX_VISIBLE
  const currentUser = currentUserIndex >= 0 ? rankingSource[currentUserIndex] : null

  return (
    <div className="flex flex-col gap-4">
      {currentUserOutside && currentUser && (
        <div className="surf-card texture-noise rounded-3xl p-4 no-hover">
          <div className="flex items-center gap-2 mb-2">
            <User className="size-4 text-[var(--cta-primary)]" />
            <p className="sport-label text-xs text-[var(--text-muted)]">Sua posição</p>
          </div>
          <ul>
            <PlayerRow player={currentUser} index={currentUserIndex} isCurrentUser />
          </ul>
        </div>
      )}

      {/* Top 20 ranking */}
      <div className="surf-card texture-noise rounded-3xl p-5 no-hover">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="sport-label text-xs text-[var(--text-muted)]">Ranking geral</p>
            <h3 className="text-xl font-bold text-[var(--text-heading)]">
              {isSearching ? `${players.length} resultado${players.length !== 1 ? 's' : ''}` : `Top ${Math.min(MAX_VISIBLE, players.length)}`}
            </h3>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-[var(--shell)] px-3 py-1 text-xs font-semibold text-[var(--cta-primary)]">
            <Waves className="size-3.5" />
            {totalPlayers ?? players.length} jogadores
          </div>
        </div>

        {players.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-[var(--text-muted)]">
            <Trophy className="size-10 opacity-40" />
            <p className="text-sm">
              {isSearching ? 'Nenhum usuário encontrado para essa busca.' : 'Nenhum jogador cadastrado ainda.'}
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--wave-line)]">
            {visiblePlayers.map((player) => {
              const playerIndex = rankingSource.findIndex((entry) => entry.uid === player.uid)

              return (
                <PlayerRow
                  key={player.uid}
                  player={player}
                  index={playerIndex >= 0 ? playerIndex : 0}
                  isCurrentUser={player.uid === currentUserId}
                />
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
