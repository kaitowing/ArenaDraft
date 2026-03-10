import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { AuthGuard } from '#/features/auth/AuthGuard'
import { useMatch } from '#/features/matches/matchQueries'
import { updateMatchScore } from '#/features/matches/matchService'
import { useTournamentPlayers } from '#/features/tournaments/tournamentQueries'
import { ScoreInput } from '#/features/matches/ScoreInput'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { useToast } from '#/hooks/useToast'
import { useAuth } from '#/features/auth/useAuth'
import type { AppUser } from '#/types'

export const Route = createFileRoute('/tournaments/$tournamentId/match/$matchId')({
  component: MatchPage,
})

function MatchPage() {
  return (
    <AuthGuard>
      <MatchContent />
    </AuthGuard>
  )
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

function TeamDisplay({ playerIds, players }: { playerIds: readonly string[]; players: AppUser[] }) {
  return (
    <div className="flex flex-col items-center gap-2">
      {playerIds.map((uid) => {
        const p = players.find((pl) => pl.uid === uid)
        return (
          <div key={uid} className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={p?.photoURL ?? undefined} />
              <AvatarFallback className="text-xs">{p ? getInitials(p.displayName) : '?'}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-[var(--sea-ink)]">
              {p?.displayName ?? uid.slice(0, 8)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function MatchContent() {
  const { tournamentId, matchId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { user } = useAuth()

  const { data: match, isLoading: mLoading } = useMatch(matchId)
  const { data: players = [], isLoading: pLoading } = useTournamentPlayers(
    match ? [...match.teamA.playerIds, ...match.teamB.playerIds] : [],
  )

  const [scoreA, setScoreA] = useState(0)
  const [scoreB, setScoreB] = useState(0)
  const [saving, setSaving] = useState(false)

  const isLoading = mLoading || pLoading
  const alreadyFinished = match?.status === 'finished'

  async function handleSave() {
    if (!user || !match) return
    if (scoreA === scoreB) {
      toast({ variant: 'destructive', title: 'Placar empatado não é permitido.' })
      return
    }
    setSaving(true)
    try {
      await updateMatchScore(matchId, scoreA, scoreB, user.uid)
      await queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
      await queryClient.invalidateQueries({ queryKey: ['match', matchId] })
      await queryClient.invalidateQueries({ queryKey: ['ranking'] })
      toast({ title: 'Placar salvo! ✓' })
      void navigate({ to: '/tournaments/$tournamentId', params: { tournamentId } })
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao salvar placar', description: String(err) })
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-lg px-4 pb-28 pt-6 space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-56 w-full rounded-3xl" />
        <Skeleton className="h-56 w-full rounded-3xl" />
      </main>
    )
  }

  if (!match) {
    return (
      <main className="mx-auto max-w-lg px-4 pt-6 text-center">
        <p className="text-[var(--sea-ink-soft)]">Partida não encontrada.</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-lg px-4 pb-28 pt-6">
      <div className="mb-6 rise-in">
        <button
          type="button"
          onClick={() => void navigate({ to: '/tournaments/$tournamentId', params: { tournamentId } })}
          className="mb-3 flex items-center gap-1 text-sm text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)] cursor-pointer"
        >
          <ChevronLeft className="size-4" />
          Voltar ao torneio
        </button>
        <h1 className="display-title text-2xl font-bold text-[var(--sea-ink)]">
          Placar · Rodada {match.round}
        </h1>
      </div>

      {alreadyFinished ? (
        <div className="rise-in island-shell rounded-3xl p-8 text-center">
          <p className="text-lg font-bold text-[var(--sea-ink)]">Partida finalizada</p>
          <p className="mt-2 text-4xl font-bold tabular-nums text-[var(--lagoon-deep)]">
            {match.teamA.score} – {match.teamB.score}
          </p>
          <div className="mt-6 flex justify-around">
            <TeamDisplay playerIds={match.teamA.playerIds} players={players} />
            <TeamDisplay playerIds={match.teamB.playerIds} players={players} />
          </div>
        </div>
      ) : (
        <div className="space-y-4 rise-in">
          <div className="island-shell rounded-3xl p-4 mb-2">
            <div className="flex justify-around">
              <TeamDisplay playerIds={match.teamA.playerIds} players={players} />
              <span className="self-center text-sm font-bold text-[var(--sea-ink-soft)]">VS</span>
              <TeamDisplay playerIds={match.teamB.playerIds} players={players} />
            </div>
          </div>

          <ScoreInput
            label={players.find((p) => p.uid === match.teamA.playerIds[0])?.displayName.split(' ')[0] + ' & ' + (players.find((p) => p.uid === match.teamA.playerIds[1])?.displayName.split(' ')[0] ?? '…')}
            score={scoreA}
            onIncrement={() => setScoreA((s) => s + 1)}
            onDecrement={() => setScoreA((s) => Math.max(0, s - 1))}
            highlight={scoreA > scoreB}
          />
          <ScoreInput
            label={players.find((p) => p.uid === match.teamB.playerIds[0])?.displayName.split(' ')[0] + ' & ' + (players.find((p) => p.uid === match.teamB.playerIds[1])?.displayName.split(' ')[0] ?? '…')}
            score={scoreB}
            onIncrement={() => setScoreB((s) => s + 1)}
            onDecrement={() => setScoreB((s) => Math.max(0, s - 1))}
            highlight={scoreB > scoreA}
          />

          <Button
            size="lg"
            className="w-full shadow-xl mt-2"
            onClick={handleSave}
            disabled={saving || scoreA === scoreB}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : 'Confirmar placar'}
          </Button>
          {scoreA === scoreB && scoreA > 0 && (
            <p className="text-center text-sm text-amber-600">Placar empatado — ajuste os pontos</p>
          )}
        </div>
      )}
    </main>
  )
}
