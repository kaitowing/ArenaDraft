import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Trophy, Mars, Venus, Medal } from 'lucide-react'
import { AuthGuard } from '#/features/auth/AuthGuard'
import { usePlayerProfile, useMedals } from '#/features/ranking/rankingQueries'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import type { Gender } from '#/types'

function medalLabel(id: string) {
  if (id === 'owner_of_the_court') return 'Dono da quadra'
  return id
}

function medalDescription(id: string) {
  if (id === 'owner_of_the_court') return 'Venceu um torneio todos x todos sem perder set/jogo.'
  return 'Conquista desbloqueada.'
}

export const Route = createFileRoute('/players/$userId')({
  component: PlayerProfilePage,
})

function PlayerProfilePage() {
  return (
    <AuthGuard>
      <PlayerProfileContent />
    </AuthGuard>
  )
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function genderLabel(gender: Gender) {
  switch (gender) {
    case 'male':
      return 'Masculino'
    case 'female':
      return 'Feminino'
  }
}

function genderIcon(gender: Gender) {
  switch (gender) {
    case 'male':
      return <Mars className="size-3.5" />
    case 'female':
      return <Venus className="size-3.5" />
  }
}

function PlayerProfileContent() {
  const { userId } = Route.useParams()
  const { data: player, isLoading } = usePlayerProfile(userId)
  const { data: medals = [] } = useMedals(userId)

  if (isLoading) {
    return (
      <main className="mx-auto max-w-lg px-4 pb-28 pt-6">
        <div className="mb-6">
          <Skeleton className="h-5 w-20 mb-3" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </main>
    )
  }

  if (!player) {
    return (
      <main className="mx-auto max-w-lg px-4 pt-6 text-center">
        <Link to="/" className="mb-3 flex items-center gap-1 text-sm text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]">
          <ArrowLeft className="size-4" />
          Voltar
        </Link>
        <p className="text-[var(--sea-ink-soft)] mt-6">Jogador não encontrado.</p>
      </main>
    )
  }

  const winRate =
    player.stats.matchesWon + player.stats.matchesLost > 0
      ? Math.round(
          (player.stats.matchesWon /
            (player.stats.matchesWon + player.stats.matchesLost)) *
            100,
        )
      : 0

  return (
    <main className="mx-auto max-w-lg px-4 pb-28 pt-6">
      <div className="mb-6 rise-in">
        <Link
          to="/"
          className="mb-3 flex items-center gap-1 text-sm text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
        >
          <ArrowLeft className="size-4" />
          Voltar
        </Link>
        <h1 className="display-title text-2xl font-bold text-[var(--sea-ink)]">Perfil do Jogador</h1>
      </div>

      <div className="space-y-6">
        {/* Profile Header */}
        <Card className="rise-in">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={player.photoURL ?? undefined} />
                <AvatarFallback className="text-xl">
                  {getInitials(player.displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-[var(--sea-ink)]">
                  {player.displayName}
                </h2>
                <p className="text-sm text-[var(--sea-ink-soft)]">
                  MMR: {player.mmr}
                </p>
                {player.gender && (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--sea-ink)]">
                    {genderIcon(player.gender)}
                    {genderLabel(player.gender)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card className="rise-in" style={{ animationDelay: '60ms' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4 text-[var(--lagoon-deep)]" />
              Estatísticas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-[var(--lagoon-deep)]">
                  {player.stats.matchesWon}
                </p>
                <p className="text-xs text-[var(--sea-ink-soft)]">Vitórias</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--sea-ink)]">
                  {player.stats.matchesLost}
                </p>
                <p className="text-xs text-[var(--sea-ink-soft)]">Derrotas</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--cta-accent)]">
                  {winRate}%
                </p>
                <p className="text-xs text-[var(--sea-ink-soft)]">Winrate</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--sea-ink-soft)]">
                  {player.stats.tournamentsPlayed}
                </p>
                <p className="text-xs text-[var(--sea-ink-soft)]">Torneios</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rise-in" style={{ animationDelay: '120ms' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Medal className="size-4 text-[var(--cta-primary)]" />
              Medalhas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {medals.length === 0 ? (
              <p className="text-sm text-[var(--sea-ink-soft)]">Sem medalhas ainda.</p>
            ) : (
              <div className="space-y-2">
                {medals.map((medal, index) => (
                    <div
                      key={`${medal.id}-${medal.tournamentId}-${index}`}
                      className="island-shell rounded-2xl px-3 py-2.5"
                    >
                      <p className="text-sm font-semibold text-[var(--sea-ink)]">{medalLabel(medal.id)}</p>
                      <p className="text-xs text-[var(--sea-ink-soft)]">{medalDescription(medal.id)}</p>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                        Conquistada em {medal.awardedAt.toDate().toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
