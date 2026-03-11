import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { ChevronLeft, Check, Copy, Swords, Trophy, Layers, Grid3x3, Medal, Dices } from 'lucide-react'
import { AuthGuard } from '#/features/auth/AuthGuard'
import { useTournamentRealtime, useTournamentPlayers } from '#/features/tournaments/tournamentQueries'
import { forceCompleteTournament, cancelTournament, startTournament } from '#/features/tournaments/tournamentService'
import { useMatchesRealtime } from '#/features/matches/matchQueries'
import { PairEditor } from '#/features/tournaments/PairEditor'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Skeleton } from '#/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { useToast } from '#/hooks/useToast'
import { useAuth } from '#/features/auth/useAuth'
import { useQueryClient } from '@tanstack/react-query'
import { useTournamentMedals } from '#/features/ranking/rankingQueries'
import type { AppUser, Match, Tournament, MedalAward } from '#/types'
import type { Pair } from '#/features/tournaments/algorithms'

function medalLabel(id: string) {
  if (id === 'owner_of_the_court') return 'Dono da quadra'
  return id
}

export const Route = createFileRoute('/tournaments/$tournamentId/')({
  component: TournamentPage,
})

function TournamentPage() {
  return (
    <AuthGuard>
      <TournamentContent />
    </AuthGuard>
  )
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

function PlayerChip({ player, align = 'left' }: { player: AppUser; align?: 'left' | 'right' }) {
  return (
    <Link
      to="/players/$userId"
      params={{ userId: player.uid }}
      className={`flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--shell)_85%,transparent)] px-2 py-1 transition-colors hover:bg-[color-mix(in_oklab,var(--shell)_100%,transparent)] cursor-pointer ${
        align === 'right' ? 'flex-row-reverse text-right' : ''
      }`}
    >
      <Avatar className="h-7 w-7 border border-white/60 shadow-sm">
        <AvatarImage src={player.photoURL ?? undefined} />
        <AvatarFallback className="text-[10px]">{getInitials(player.displayName)}</AvatarFallback>
      </Avatar>
      <span className="truncate text-sm font-semibold text-[var(--text-heading)]">
        {player.displayName}
      </span>
    </Link>
  )
}

function MatchCard({ match, players }: { match: Match; players: AppUser[] }) {
  const getPlayer = (uid: string) => players.find((p) => p.uid === uid)
  const finished = match.status === 'finished'
  const aWon = finished && (match.teamA.score ?? 0) > (match.teamB.score ?? 0)
  const bWon = finished && (match.teamB.score ?? 0) > (match.teamA.score ?? 0)
  const navigate = useNavigate()

  const inner = (
    <div
      className={`surf-card texture-noise rounded-3xl p-4 transition-all ${
        finished ? 'opacity-95' : 'hover:shadow-lg active:scale-[0.98] cursor-pointer'
      }`}
    >
      <div className="mb-3 flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span className="sport-label text-[11px]">
          {match.stage === 'playoff' && match.bracketRound
            ? (BRACKET_ROUND_LABELS[match.bracketRound] ?? match.bracketRound)
            : `Rodada ${match.round}`}
        </span>
        <Badge className={finished ? 'bg-[var(--palm)]/15 text-[var(--palm)]' : 'bg-[var(--cta-primary)]/15 text-[var(--cta-primary)]'}>
          {finished ? 'Finalizado' : 'Pendente'}
        </Badge>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className={`flex flex-col gap-2 min-w-0 ${aWon ? 'scale-[1.02]' : 'opacity-90'}`}>
          {match.teamA.playerIds.map((uid) => {
            const p = getPlayer(uid)
            return p ? (
              <PlayerChip key={uid} player={p} />
            ) : (
              <span key={uid} className="text-xs text-[var(--text-muted)]">
                {uid.slice(0, 6)}
              </span>
            )
          })}
        </div>
        <div className="shrink-0 text-center">
          {finished ? (
            <div className="flex flex-col items-center gap-0.5 rounded-2xl bg-[var(--shell)] px-3 py-2">
              <span className="text-2xl font-black tabular-nums text-[var(--text-heading)]">
                {match.teamA.score} – {match.teamB.score}
              </span>
              <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
                {match.scoringFormat === 'sets' ? 'SETS' : 'PLACAR'}
              </span>
            </div>
          ) : (
            <div className="rounded-full bg-[var(--shell)] px-3 py-1 text-[var(--text-muted)]">
              <Swords className="size-5" />
            </div>
          )}
        </div>
        <div className={`flex flex-col gap-2 min-w-0 items-end ${bWon ? 'scale-[1.02]' : 'opacity-90'}`}>
          {match.teamB.playerIds.map((uid) => {
            const p = getPlayer(uid)
            return p ? (
              <PlayerChip key={uid} player={p} align="right" />
            ) : (
              <span key={uid} className="text-xs text-[var(--text-muted)]">
                {uid.slice(0, 6)}
              </span>
            )
          })}
        </div>
      </div>

      {!finished && (
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-[var(--shell)]/60 px-3 py-2 text-xs font-semibold text-[var(--cta-primary)]">
          Registrar placar
          <span aria-hidden="true">→</span>
        </div>
      )}
    </div>
  )

  if (finished) return <div>{inner}</div>

  return (
    <button
      type="button"
      onClick={() =>
        void navigate({ to: '/tournaments/$tournamentId/match/$matchId', params: { tournamentId: match.tournamentId, matchId: match.id } })
      }
      className="block w-full text-left"
    >
      {inner}
    </button>
  )
}

function StandingsCard({ matches, players }: { matches: Match[]; players: AppUser[] }) {
  const finishedMatches = matches.filter((m) => m.status === 'finished')

  const stats = new Map<string, { wins: number; losses: number; pts: number }>()
  for (const player of players) {
    stats.set(player.uid, { wins: 0, losses: 0, pts: 0 })
  }

  for (const match of finishedMatches) {
    const aWon = (match.teamA.score ?? 0) > (match.teamB.score ?? 0)
    for (const uid of match.teamA.playerIds) {
      const s = stats.get(uid) ?? { wins: 0, losses: 0, pts: 0 }
      if (aWon) s.wins++; else s.losses++
      s.pts = s.wins * 2
      stats.set(uid, s)
    }
    for (const uid of match.teamB.playerIds) {
      const s = stats.get(uid) ?? { wins: 0, losses: 0, pts: 0 }
      if (!aWon) s.wins++; else s.losses++
      s.pts = s.wins * 2
      stats.set(uid, s)
    }
  }

  const sorted = players.slice().sort((a, b) => (stats.get(b.uid)?.pts ?? 0) - (stats.get(a.uid)?.pts ?? 0))

  return (
    <div className="surf-card texture-noise rounded-3xl p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-full bg-[var(--cta-primary)]/15 p-2 text-[var(--cta-primary)]">
          <Trophy className="size-4" />
        </div>
        <div>
          <p className="sport-label text-[11px] text-[var(--text-muted)]">Classificação</p>
          <h3 className="text-xl font-bold text-[var(--text-heading)]">Quadro geral</h3>
        </div>
      </div>
      <ul className="divide-y divide-[var(--wave-line)]">
        {sorted.map((player, idx) => {
          const s = stats.get(player.uid) ?? { wins: 0, losses: 0, pts: 0 }
          return (
            <li key={player.uid} className="flex items-center gap-3 px-1 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--shell)_80%,transparent)] text-sm font-bold text-[var(--text-heading)]">
                {idx + 1}
              </span>
              <Avatar className="h-8 w-8 border border-white/60 shadow">
                <AvatarImage src={player.photoURL ?? undefined} />
                <AvatarFallback className="text-[10px]">{getInitials(player.displayName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--text-heading)]">{player.displayName}</p>
                <p className="text-[11px] text-[var(--text-muted)]">{s.wins}V · {s.losses}D</p>
              </div>
              <span className="rounded-full bg-[var(--shell)] px-3 py-1 text-xs font-semibold text-[var(--text-heading)] tabular-nums">
                {s.pts} pts
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function GroupsTab({ tournament, players }: { tournament: Tournament; players: AppUser[] }) {
  if (!tournament.groups?.length) {
    return (
      <p className="text-center text-sm text-[var(--text-muted)] py-8">Grupos não disponíveis.</p>
    )
  }
  return (
    <div className="space-y-4">
      {tournament.groups.map((group) => (
        <div key={group.id} className="surf-card texture-noise rounded-3xl p-4">
          <p className="island-kicker text-xs mb-3">Grupo {group.id}</p>
          <ul className="divide-y divide-[var(--wave-line)]">
            {[...group.teams]
              .sort((a, b) => b.wins - a.wins || a.losses - b.losses || b.points - a.points)
              .map((team, idx) => {
                const p1 = players.find((p) => p.uid === team.playerIds[0])
                const p2 = players.find((p) => p.uid === team.playerIds[1])
                return (
                  <li key={team.teamId ?? idx} className="flex items-center gap-3 px-1 py-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--shell)] text-xs font-bold text-[var(--text-heading)]">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--text-heading)]">
                        {p1?.displayName ?? '?'} &amp; {p2?.displayName ?? '?'}
                      </p>
                    </div>
                    <span className="text-xs text-[var(--text-muted)]">{team.wins}V {team.losses}D</span>
                    <span className="rounded-full bg-[var(--shell)] px-2.5 py-1 text-xs font-bold tabular-nums">
                      {team.points} pts
                    </span>
                  </li>
                )
              })}
          </ul>
        </div>
      ))}
    </div>
  )
}

const BRACKET_ROUND_LABELS: Record<string, string> = {
  R16: 'Oitavas',
  QF: 'Quartas de final',
  SF: 'Semifinal',
  F: 'Final',
}

function BracketTab({ matches, players }: { matches: Match[]; players: AppUser[] }) {
  const playoffMatches = matches.filter((m) => m.stage === 'playoff')
  if (!playoffMatches.length) {
    return (
      <div className="surf-card texture-noise rounded-3xl px-5 py-8 text-center">
        <Swords className="mx-auto mb-3 size-8 text-[var(--text-muted)]" />
        <p className="text-sm font-semibold text-[var(--text-heading)]">Eliminatórias ainda não iniciadas</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Conclua a fase de grupos para gerar o bracket.</p>
      </div>
    )
  }
  const roundOrder = ['R16', 'QF', 'SF', 'F']
  return (
    <div className="space-y-4">
      {roundOrder.map((round) => {
        const roundMatches = playoffMatches.filter((m) => m.bracketRound === round)
        if (!roundMatches.length) return null
        return (
          <div key={round}>
            <p className="island-kicker text-xs mb-2">{BRACKET_ROUND_LABELS[round] ?? round}</p>
            <div className="space-y-2">
              {roundMatches.map((match) => (
                <MatchCard key={match.id} match={match} players={players} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function LobbyView({
  tournament,
  players,
}: {
  tournament: Tournament
  players: AppUser[]
}) {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [starting, setStarting] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  const isOwner = user?.uid === tournament.createdBy
  const canStart = players.length >= 4 && players.length % 2 === 0
  const organizerPlayer = players.find((p) => p.uid === tournament.createdBy)

  async function copyCode() {
    await navigator.clipboard.writeText(tournament.joinCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleStart(pairs: Pair[]) {
    setStarting(true)
    try {
      await startTournament(tournament.id, pairs)
      await queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] })
      await queryClient.invalidateQueries({ queryKey: ['matches', tournament.id] })
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao iniciar torneio', description: String(err) })
    } finally {
      setStarting(false)
    }
  }

  async function handleStartRandomPairs() {
    // Build dummy pairs from the full player list — the algorithm will use them as individuals
    const dummyPairs: Pair[] = []
    for (let i = 0; i < players.length - 1; i += 2) {
      dummyPairs.push([players[i], players[i + 1]])
    }
    await handleStart(dummyPairs)
  }

  async function handleCancel() {
    try {
      await cancelTournament(tournament.id)
      toast({ title: 'Torneio cancelado!' })
      // Navigate back to tournaments list
      window.location.href = '/tournaments'
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao cancelar torneio', description: String(err) })
    }
  }

  if (showEditor && !tournament.randomPairs) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setShowEditor(false)}
          className="flex items-center gap-1 text-sm text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)] cursor-pointer"
        >
          <ChevronLeft className="size-4" />
          Voltar ao lobby
        </button>
        <h2 className="display-title text-xl font-bold text-[var(--sea-ink)]">Definir duplas</h2>
        <PairEditor players={players} onConfirm={handleStart} loading={starting} pairPolicy={tournament.pairPolicy} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {isOwner ? (
        <div className="surf-card texture-noise rounded-3xl p-5 text-center">
          <p className="sport-label text-[11px] text-[var(--text-muted)] mb-2">Código do torneio</p>
          <p className="display-title text-4xl font-bold tracking-[0.35em] text-[var(--cta-primary)] mb-3">
            {tournament.joinCode}
          </p>
          <Button variant="outline" size="sm" onClick={copyCode} className="gap-1.5">
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? 'Copiado!' : 'Copiar código'}
          </Button>
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Compartilhe com os jogadores para eles entrarem no torneio.
          </p>
        </div>
      ) : (
        <div className="surf-card texture-noise rounded-3xl p-5 text-center">
          <p className="sport-label text-[11px] text-[var(--text-muted)] mb-2">Lobby privado</p>
          <p className="text-lg font-semibold text-[var(--text-heading)]">
            Somente o organizador vê o código deste torneio.
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Peça o código para {organizerPlayer?.displayName ?? 'o organizador'} para participar.
          </p>
        </div>
      )}

      <div>
        <p className="island-kicker text-xs mb-3">
          {players.length} jogador{players.length !== 1 ? 'es' : ''} no lobby
        </p>
        <div className="space-y-2">
          {players.map((player) => (
            <Link
              key={player.uid}
              to="/players/$userId"
              params={{ userId: player.uid }}
              className="island-shell rounded-xl px-4 py-2.5 flex items-center gap-3 transition-colors hover:bg-[color-mix(in_oklab,var(--shell)_100%,transparent)] cursor-pointer"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={player.photoURL ?? undefined} />
                <AvatarFallback className="text-[10px]">{getInitials(player.displayName)}</AvatarFallback>
              </Avatar>
              <span className="flex-1 text-sm font-medium text-[var(--sea-ink)]">{player.displayName}</span>
              <Badge variant="secondary">{player.mmr} MMR</Badge>
              {player.uid === tournament.createdBy && (
                <Badge variant="default" className="text-[10px]">Organizador</Badge>
              )}
            </Link>
          ))}
        </div>
      </div>

      {isOwner ? (
        <div className="space-y-2">
          {!canStart && (
            <p className="text-center text-xs text-amber-600">
              {players.length < 4
                ? `Aguardando mais jogadores (mínimo 4, faltam ${4 - players.length})`
                : 'Número de jogadores deve ser par'}
            </p>
          )}
          {tournament.randomPairs ? (
            <Button
              className="w-full gap-2"
              size="lg"
              disabled={!canStart || starting}
              onClick={() => void handleStartRandomPairs()}
            >
              {starting ? (
                <>Sorteando duplas…</>
              ) : (
                <>
                  <Dices className="size-4" />
                  Sortear duplas e iniciar
                </>
              )}
            </Button>
          ) : (
            <Button
              className="w-full"
              size="lg"
              disabled={!canStart}
              onClick={() => setShowEditor(true)}
            >
              Definir duplas e iniciar
            </Button>
          )}
          <Button
            variant="destructive"
            className="w-full"
            size="sm"
            onClick={() => setShowCancelDialog(true)}
          >
            Cancelar torneio
          </Button>
        </div>
      ) : (
        <p className="text-center text-sm text-[var(--sea-ink-soft)]">
          Aguardando o organizador iniciar o torneio…
        </p>
      )}
      
      {/* Cancel Tournament Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="bg-white/95 text-[var(--sea-ink)] backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-red-600">Cancelar torneio</DialogTitle>
            <DialogDescription className="text-sm text-[var(--sea-ink-soft)]">
              Tem certeza que deseja cancelar o torneio <strong>"{tournament.name}"</strong>? 
              Esta ação não pode ser desfeita e todos os jogadores serão removidos do lobby.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowCancelDialog(false)}
            >
              Voltar
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                setShowCancelDialog(false)
                handleCancel()
              }}
            >
              Cancelar torneio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TournamentContent() {
  const { tournamentId } = Route.useParams()
  const { user } = useAuth()
  const { data: tournament, isLoading: tLoading, error: tError } = useTournamentRealtime(tournamentId)
  const canLoadMatches = Boolean(tournament && tournament.status !== 'waiting')
  const { data: matches = [], isLoading: mLoading, error: mError } = useMatchesRealtime(tournamentId, {
    enabled: canLoadMatches,
  })
  const { data: players = [], isLoading: pLoading, error: pError } = useTournamentPlayers(
    tournament?.participants ?? [],
  )
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: tournamentMedals = [] } = useTournamentMedals(tournamentId)

  const isLoading = tLoading || mLoading || pLoading
  const roundNumbers = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b)
  const totalMatches = matches.length
  const finishedMatches = matches.filter((m) => m.status === 'finished').length
  const isOrganizer = user && tournament?.createdBy === user.uid
  const canForceComplete = tournament?.status === 'in_progress' && isOrganizer

  const medalWinners = tournamentMedals
    .map((medal) => ({ medal, player: players.find((p) => p.uid === medal.uid) }))
    .filter((entry): entry is { medal: MedalAward; player: AppUser } => Boolean(entry.player))
  async function handleForceComplete() {
    if (!tournament) return
    try {
      await forceCompleteTournament(tournament.id)
      await queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] })
      toast({ title: 'Torneio finalizado!' })
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao finalizar torneio', description: String(err) })
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-lg px-4 pb-28 pt-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-60 w-full rounded-2xl" />
      </main>
    )
  }

  if (!tournament) {
    return (
      <main className="mx-auto max-w-lg px-4 pt-6 text-center">
        <p className="text-[var(--sea-ink-soft)]">
          {tError ? `Erro: ${String(tError)}` : 'Torneio não encontrado.'}
        </p>
      </main>
    )
  }

  if (mError || pError) {
    return (
      <main className="mx-auto max-w-lg px-4 pb-28 pt-6 space-y-4">
        <Link to="/tournaments" className="mb-3 flex items-center gap-1 text-sm text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]">
          <ChevronLeft className="size-4" /> Torneios
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Erro ao carregar dados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-[var(--sea-ink-soft)]">
            {mError && <p>Partidas: {String(mError)}</p>}
            {pError && <p>Jogadores: {String(pError)}</p>}
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-lg px-4 pb-28 pt-6">
      <div className="mb-6 rise-in">
        <Link to="/tournaments" className="mb-3 flex items-center gap-1 text-sm text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]">
          <ChevronLeft className="size-4" />
          Torneios
        </Link>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="display-title text-2xl font-bold text-[var(--sea-ink)]">{tournament.name}</h1>
            <p className="text-sm text-[var(--sea-ink-soft)]">
              {new Date(tournament.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {tournament.format === 'classic' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  <Swords className="size-2.5" /> Clássico
                </span>
              )}
              {tournament.randomPairs && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <Dices className="size-2.5" /> Duplas aleatórias
                </span>
              )}
              {tournament.category === 'mixed' && (
                <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700">Misto</span>
              )}
              {tournament.category === 'unisex' && (
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Unissex</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {tournament.status === 'waiting' ? (
              <Badge variant="secondary">Aguardando</Badge>
            ) : (
              <Badge variant={tournament.status === 'completed' ? 'success' : 'default'}>
                {finishedMatches}/{totalMatches} jogos
              </Badge>
            )}
            {canForceComplete && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleForceComplete}
                className="text-xs px-3 py-1 h-auto"
              >
                Finalizar torneio
              </Button>
            )}
          </div>
        </div>
      </div>

      {tournament.status === 'waiting' ? (
        <div className="rise-in" style={{ animationDelay: '60ms' }}>
          <LobbyView tournament={tournament} players={players} />
        </div>
      ) : (
        <div className="space-y-4">
          {tournament.format === 'classic' ? (
            <Tabs defaultValue="groups" className="w-full">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="groups" className="flex-1 gap-1">
                  <Layers className="size-3.5" /> Grupos
                </TabsTrigger>
                <TabsTrigger value="bracket" className="flex-1 gap-1">
                  <Swords className="size-3.5" /> Eliminatórias
                </TabsTrigger>
                <TabsTrigger value="all" className="flex-1 gap-1">
                  <Grid3x3 className="size-3.5" /> Partidas
                </TabsTrigger>
              </TabsList>
              <TabsContent value="groups">
                <GroupsTab tournament={tournament} players={players} />
              </TabsContent>
              <TabsContent value="bracket">
                <BracketTab matches={matches} players={players} />
              </TabsContent>
              <TabsContent value="all">
                <div className="space-y-4">
                  {roundNumbers.map((round, ri) => (
                    <div key={round} className="rise-in" style={{ animationDelay: `${ri * 60}ms` }}>
                      <p className="island-kicker mb-2 px-1">Rodada {round}</p>
                      <div className="space-y-2">
                        {matches
                          .filter((m) => m.round === round)
                          .map((match) => (
                            <MatchCard key={match.id} match={match} players={players} />
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <>
              {players.length > 0 && (
                <div className="rise-in" style={{ animationDelay: '60ms' }}>
                  <StandingsCard matches={matches} players={players} />
                </div>
              )}
              {roundNumbers.map((round, ri) => (
                <div key={round} className="rise-in" style={{ animationDelay: `${(ri + 2) * 60}ms` }}>
                  <p className="island-kicker mb-2 px-1">Rodada {round}</p>
                  <div className="space-y-2">
                    {matches
                      .filter((m) => m.round === round)
                      .map((match) => (
                        <MatchCard key={match.id} match={match} players={players} />
                      ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
      {tournament.status === 'completed' && medalWinners.length > 0 && (
        <div className="rise-in mb-4">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Medal className="size-4 text-[var(--cta-primary)]" />
                Campeões de Medalhas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {medalWinners.map(({ medal, player }) => (
                <div key={`${medal.uid}-${medal.tournamentId}`} className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={player.photoURL ?? undefined} />
                    <AvatarFallback className="text-sm">{player.displayName.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold text-[var(--sea-ink)]">{player.displayName}</p>
                    <p className="text-xs text-[var(--sea-ink-soft)]">
                      {medalLabel(medal.id)} · {medal.awardedAt.toDate().toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  )
}
