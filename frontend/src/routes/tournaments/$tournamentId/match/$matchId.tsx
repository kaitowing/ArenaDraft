import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { ChevronLeft, Loader2, Plus, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { AuthGuard } from '#/features/auth/AuthGuard'
import { useMatchRealtime } from '#/features/matches/matchQueries'
import { updateMatchScore } from '#/features/matches/matchService'
import { useTournamentPlayers } from '#/features/tournaments/tournamentQueries'
import { usePrefetchProfileImages } from '#/features/auth/imageQueries'
import { ScoreInput } from '#/features/matches/ScoreInput'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { UserAvatar } from '#/components/UserAvatar'
import { Badge } from '#/components/ui/badge'
import { useToast } from '#/hooks/useToast'
import { useAuth } from '#/features/auth/useAuth'
import type { AppUser, Match } from '#/types'

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

const BRACKET_LABELS: Record<string, string> = { R16: 'Oitavas', QF: 'Quartas', SF: 'Semifinal', F: 'Final' }

function matchRoundLabel(match: Match): string {
  if (match.stage === 'playoff' && match.bracketRound) {
    return BRACKET_LABELS[match.bracketRound] ?? match.bracketRound
  }
  return `Rodada ${match.round}`
}

function teamLabel(playerIds: readonly string[], players: AppUser[]) {
  return playerIds
    .map((uid) => players.find((p) => p.uid === uid)?.displayName.split(' ')[0] ?? '…')
    .join(' & ')
}

function TeamDisplay({ playerIds, players }: { playerIds: readonly string[]; players: AppUser[] }) {
  return (
    <div className="flex flex-col items-start gap-2">
      {playerIds.map((uid) => {
        const p = players.find((pl) => pl.uid === uid)
        return (
          <div key={uid} className="flex items-center gap-2">
            <UserAvatar uid={uid} displayName={p?.displayName ?? uid.slice(0, 8)} size="sm" />
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

  const { data: match, isLoading: mLoading } = useMatchRealtime(matchId)
  const { data: players = [], isLoading: pLoading } = useTournamentPlayers(
    match ? [...match.teamA.playerIds, ...match.teamB.playerIds] : [],
  )
  usePrefetchProfileImages(players.map((p) => p.uid))

  const [scoringFormat, setScoringFormat] = useState<'points' | 'sets'>('points')
  const [pointsA, setPointsA] = useState(0)
  const [pointsB, setPointsB] = useState(0)
  const [sets, setSets] = useState<{ a: number; b: number }[]>([{ a: 0, b: 0 }])
  const [saving, setSaving] = useState(false)

  const isLoading = mLoading || pLoading
  const alreadyFinished = match?.status === 'finished'

  const setsWinsA = sets.filter((s) => s.a > s.b).length
  const setsWinsB = sets.filter((s) => s.b > s.a).length
  const setsValid = sets.length > 0 && setsWinsA !== setsWinsB && sets.every((s) => s.a !== s.b)
  const pointsValid = pointsA !== pointsB

  function addSet() {
    setSets((prev) => [...prev, { a: 0, b: 0 }])
  }

  function removeSet(idx: number) {
    setSets((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateSet(idx: number, side: 'a' | 'b', val: number) {
    setSets((prev) => prev.map((s, i) => (i === idx ? { ...s, [side]: Math.max(0, val) } : s)))
  }

  async function handleSave() {
    if (!user || !match) return
    setSaving(true)
    try {
      if (scoringFormat === 'points') {
        await updateMatchScore(matchId, { scoringFormat: 'points', pointsA, pointsB }, user.uid)
      } else {
        await updateMatchScore(
          matchId,
          { scoringFormat: 'sets', setsA: sets.map((s) => s.a), setsB: sets.map((s) => s.b) },
          user.uid,
        )
      }
      await queryClient.invalidateQueries({ queryKey: ['matches-realtime', tournamentId] })
      await queryClient.invalidateQueries({ queryKey: ['match-realtime', matchId] })
      await queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] })
      await queryClient.invalidateQueries({ queryKey: ['tournament-realtime', tournamentId] })
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

  const labelA = teamLabel(match.teamA.playerIds, players)
  const labelB = teamLabel(match.teamB.playerIds, players)

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
          Placar · {matchRoundLabel(match)}
        </h1>
      </div>

      {alreadyFinished ? (
        <div className="rise-in island-shell rounded-3xl p-8 text-center space-y-4">
          <p className="text-lg font-bold text-[var(--sea-ink)]">Partida finalizada</p>
          {match.scoringFormat === 'sets' && match.teamA.sets && match.teamB.sets ? (
            <div className="space-y-2">
              <p className="text-4xl font-bold tabular-nums text-[var(--lagoon-deep)]">
                {match.teamA.score} sets – {match.teamB.score} sets
              </p>
              <div className="text-sm text-[var(--sea-ink-soft)] space-y-0.5">
                {match.teamA.sets.map((pA, i) => (
                  <p key={i}>Set {i + 1}: {pA} – {match.teamB.sets![i]}</p>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-4xl font-bold tabular-nums text-[var(--lagoon-deep)]">
              {match.teamA.score} – {match.teamB.score}
            </p>
          )}
          <div className="flex justify-around pt-2">
            <TeamDisplay playerIds={match.teamA.playerIds} players={players} />
            <TeamDisplay playerIds={match.teamB.playerIds} players={players} />
          </div>
        </div>
      ) : (
        <div className="space-y-5 rise-in">
          {/* Teams header */}
          <div className="island-shell rounded-3xl p-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <TeamDisplay playerIds={match.teamA.playerIds} players={players} />
              <span className="text-sm font-bold text-[var(--sea-ink-soft)]">VS</span>
              <div className="flex flex-col items-end gap-2">
                {match.teamB.playerIds.map((uid) => {
                  const p = players.find((pl) => pl.uid === uid)
                  return (
                    <div key={uid} className="flex flex-row-reverse items-center gap-2">
                      <UserAvatar uid={uid} displayName={p?.displayName ?? uid.slice(0, 8)} size="sm" />
                      <span className="text-sm font-medium text-[var(--sea-ink)]">
                        {p?.displayName ?? uid.slice(0, 8)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Format toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setScoringFormat('points')}
              className={`flex-1 rounded-2xl py-3 text-sm font-semibold transition-all ${
                scoringFormat === 'points'
                  ? 'bg-[var(--lagoon-deep)] text-white shadow-md'
                  : 'island-shell text-[var(--sea-ink-soft)]'
              }`}
            >
              Pontos
            </button>
            <button
              type="button"
              onClick={() => setScoringFormat('sets')}
              className={`flex-1 rounded-2xl py-3 text-sm font-semibold transition-all ${
                scoringFormat === 'sets'
                  ? 'bg-[var(--lagoon-deep)] text-white shadow-md'
                  : 'island-shell text-[var(--sea-ink-soft)]'
              }`}
            >
              Sets
            </button>
          </div>

          {scoringFormat === 'points' && (
            <div className="space-y-3">
              <ScoreInput
                label={labelA}
                score={pointsA}
                onChange={setPointsA}
                highlight={pointsA > pointsB}
              />
              <ScoreInput
                label={labelB}
                score={pointsB}
                onChange={setPointsB}
                highlight={pointsB > pointsA}
              />
              {pointsA === pointsB && pointsA > 0 && (
                <p className="text-center text-sm text-amber-600">Empate — ajuste os pontos</p>
              )}
            </div>
          )}

          {/* Sets mode */}
          {scoringFormat === 'sets' && (
            <div className="space-y-3">
              {/* Sets wins summary */}
              {sets.length > 0 && (
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-semibold text-[var(--sea-ink)]">
                    {labelA}: <span className="text-[var(--lagoon-deep)]">{setsWinsA} sets</span>
                  </span>
                  <span className="text-sm font-semibold text-[var(--sea-ink)]">
                    {labelB}: <span className="text-[var(--lagoon-deep)]">{setsWinsB} sets</span>
                  </span>
                </div>
              )}

              {/* Set rows */}
              {sets.map((set, idx) => {
                const setWinner = set.a > set.b ? 'a' : set.b > set.a ? 'b' : null
                return (
                  <div key={idx} className="island-shell rounded-2xl p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--sea-ink-soft)]">Set {idx + 1}</span>
                      <div className="flex items-center gap-2">
                        {setWinner && (
                          <Badge variant={setWinner === 'a' ? 'default' : 'secondary'} className="text-[10px]">
                            {setWinner === 'a' ? labelA.split(' ')[0] : labelB.split(' ')[0]} vence
                          </Badge>
                        )}
                        {sets.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSet(idx)}
                            className="rounded-full p-1 text-[var(--sea-ink-soft)] hover:text-red-500 transition-colors"
                            aria-label="Remover set"
                          >
                            <X className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <SetPointInput
                        label={labelA}
                        value={set.a}
                        onChange={(v) => updateSet(idx, 'a', v)}
                        winning={setWinner === 'a'}
                      />
                      <span className="text-sm font-bold text-[var(--sea-ink-soft)]">×</span>
                      <SetPointInput
                        label={labelB}
                        value={set.b}
                        onChange={(v) => updateSet(idx, 'b', v)}
                        winning={setWinner === 'b'}
                        alignEnd
                      />
                    </div>
                  </div>
                )
              })}

              <button
                type="button"
                onClick={addSet}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--line)] py-3 text-sm font-medium text-[var(--sea-ink-soft)] hover:border-[var(--lagoon-deep)] hover:text-[var(--lagoon-deep)] transition-colors"
              >
                <Plus className="size-4" />
                Adicionar set
              </button>

              {!setsValid && sets.length > 0 && setsWinsA === setsWinsB && setsWinsA > 0 && (
                <p className="text-center text-sm text-amber-600">Empate de sets — adicione mais um set</p>
              )}
            </div>
          )}

          {/* Confirm button */}
          <Button
            size="lg"
            className="w-full shadow-xl"
            onClick={handleSave}
            disabled={saving || (scoringFormat === 'points' ? !pointsValid : !setsValid)}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : 'Confirmar placar'}
          </Button>
        </div>
      )}
    </main>
  )
}

function SetPointInput({
  label,
  value,
  onChange,
  winning = false,
  alignEnd = false,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  winning?: boolean
  alignEnd?: boolean
}) {
  return (
    <div className={`flex flex-col gap-1 ${alignEnd ? 'items-end' : 'items-start'}`}>
      <span className="text-[10px] font-medium text-[var(--sea-ink-soft)] truncate max-w-[100px]">{label}</span>
      <input
        type="number"
        min={0}
        max={99}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        className={`w-10 text-center text-2xl font-bold tabular-nums bg-transparent border-none outline-none ${
          winning ? 'text-[var(--lagoon-deep)]' : 'text-[var(--sea-ink)]'
        }`}
        aria-label={`Pontos do set de ${label}`}
      />
    </div>
  )
}
