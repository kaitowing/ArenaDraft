import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ChevronLeft, Check, Copy, Swords, Trophy } from 'lucide-react'
import { AuthGuard } from '#/features/auth/AuthGuard'
import { useTournament, useTournamentPlayers } from '#/features/tournaments/tournamentQueries'
import { forceCompleteTournament, cancelTournament, startTournament } from '#/features/tournaments/tournamentService'
import { useMatches } from '#/features/matches/matchQueries'
import { PairEditor } from '#/features/tournaments/PairEditor'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Skeleton } from '#/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { useToast } from '#/hooks/useToast'
import { useAuth } from '#/features/auth/useAuth'
import { useQueryClient } from '@tanstack/react-query'
import type { AppUser, Match } from '#/types'
import type { Pair } from '#/features/tournaments/algorithms'

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

function PlayerChip({ player }: { player: AppUser }) {
  return (
    <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--sea-ink)]">
      <Avatar className="h-6 w-6">
        <AvatarImage src={player.photoURL ?? undefined} />
        <AvatarFallback className="text-[10px]">{getInitials(player.displayName)}</AvatarFallback>
      </Avatar>
      {player.displayName}
    </span>
  )
}

function MatchCard({ match, players }: { match: Match; players: AppUser[] }) {
  const getPlayer = (uid: string) => players.find((p) => p.uid === uid)
  const finished = match.status === 'finished'
  const aWon = finished && (match.teamA.score ?? 0) > (match.teamB.score ?? 0)
  const bWon = finished && (match.teamB.score ?? 0) > (match.teamA.score ?? 0)

  const inner = (
    <div className={`island-shell rounded-2xl p-4 transition-all ${finished ? 'opacity-70' : 'hover:shadow-lg active:scale-[0.98] cursor-pointer'}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="island-kicker text-xs">Rodada {match.round}</span>
        <Badge variant={finished ? 'success' : 'secondary'}>
          {finished ? 'Finalizado' : 'Pendente'}
        </Badge>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className={`flex flex-col gap-1 min-w-0 ${aWon ? 'font-bold' : ''}`}>
          {match.teamA.playerIds.map((uid) => {
            const p = getPlayer(uid)
            return p ? <PlayerChip key={uid} player={p} /> : <span key={uid} className="text-xs text-[var(--sea-ink-soft)]">{uid.slice(0, 6)}</span>
          })}
        </div>
        <div className="shrink-0 text-center">
          {finished ? (
            <div className="flex flex-col items-center gap-0.5">
              {match.scoringFormat === 'sets' ? (
                <>
                  <span className="text-xl font-bold tabular-nums text-[var(--sea-ink)]">
                    {match.teamA.score}–{match.teamB.score}
                  </span>
                  <span className="text-[10px] text-[var(--sea-ink-soft)]">sets</span>
                </>
              ) : (
                <span className="text-xl font-bold tabular-nums text-[var(--sea-ink)]">
                  {match.teamA.score} – {match.teamB.score}
                </span>
              )}
            </div>
          ) : (
            <Swords className="size-5 text-[var(--sea-ink-soft)]" />
          )}
        </div>
        <div className={`flex flex-col items-end gap-1 min-w-0 ${bWon ? 'font-bold' : ''}`}>
          {match.teamB.playerIds.map((uid) => {
            const p = getPlayer(uid)
            return p ? (
              <span
                key={uid}
                className="flex flex-row-reverse items-center gap-1.5 text-sm font-medium text-[var(--sea-ink)]"
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={p.photoURL ?? undefined} />
                  <AvatarFallback className="text-[10px]">{getInitials(p.displayName)}</AvatarFallback>
                </Avatar>
                <span className="truncate text-right">{p.displayName}</span>
              </span>
            ) : <span key={uid} className="text-xs text-[var(--sea-ink-soft)]">{uid.slice(0, 6)}</span>
          })}
        </div>
      </div>

      {!finished && (
        <div className="mt-3 border-t border-[var(--line)] pt-3">
          <span className="text-xs font-semibold text-[var(--lagoon-deep)]">Registrar placar →</span>
        </div>
      )}
    </div>
  )

  if (finished) return <div>{inner}</div>

  return (
    <Link
      to="/tournaments/$tournamentId/match/$matchId"
      params={{ tournamentId: match.tournamentId, matchId: match.id }}
      className="block"
    >
      {inner}
    </Link>
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="size-4 text-[var(--lagoon-deep)]" />
          Classificação
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-[var(--line)]">
          {sorted.map((player, idx) => {
            const s = stats.get(player.uid) ?? { wins: 0, losses: 0, pts: 0 }
            return (
              <li key={player.uid} className="flex items-center gap-3 px-6 py-2.5">
                <span className="w-5 text-center text-xs font-bold text-[var(--sea-ink-soft)]">
                  {idx + 1}
                </span>
                <Avatar className="h-7 w-7">
                  <AvatarImage src={player.photoURL ?? undefined} />
                  <AvatarFallback className="text-[10px]">{getInitials(player.displayName)}</AvatarFallback>
                </Avatar>
                <p className="flex-1 truncate text-sm font-medium text-[var(--sea-ink)]">
                  {player.displayName}
                </p>
                <span className="text-xs text-[var(--sea-ink-soft)]">
                  {s.wins}V {s.losses}D
                </span>
                <Badge variant="default" className="tabular-nums">
                  {s.pts} pts
                </Badge>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

function LobbyView({
  tournament,
  players,
}: {
  tournament: import('#/types').Tournament
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

  if (showEditor) {
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
        <PairEditor players={players} onConfirm={handleStart} loading={starting} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="island-shell rounded-2xl p-5 text-center">
        <p className="island-kicker text-xs mb-2">Código do torneio</p>
        <p className="display-title text-4xl font-bold tracking-widest text-[var(--lagoon-deep)] mb-3">
          {tournament.joinCode}
        </p>
        <Button variant="outline" size="sm" onClick={copyCode} className="gap-1.5">
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copiado!' : 'Copiar código'}
        </Button>
        <p className="mt-3 text-xs text-[var(--sea-ink-soft)]">
          Compartilhe com os jogadores para eles entrarem no torneio.
        </p>
      </div>

      <div>
        <p className="island-kicker text-xs mb-3">
          {players.length} jogador{players.length !== 1 ? 'es' : ''} no lobby
        </p>
        <div className="space-y-2">
          {players.map((player) => (
            <div key={player.uid} className="island-shell rounded-xl px-4 py-2.5 flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={player.photoURL ?? undefined} />
                <AvatarFallback className="text-[10px]">{getInitials(player.displayName)}</AvatarFallback>
              </Avatar>
              <span className="flex-1 text-sm font-medium text-[var(--sea-ink)]">{player.displayName}</span>
              <Badge variant="secondary">{player.mmr} MMR</Badge>
              {player.uid === tournament.createdBy && (
                <Badge variant="default" className="text-[10px]">Organizador</Badge>
              )}
            </div>
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
          <Button
            className="w-full"
            size="lg"
            disabled={!canStart}
            onClick={() => setShowEditor(true)}
          >
            Definir duplas e iniciar
          </Button>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Cancelar torneio</DialogTitle>
            <DialogDescription>
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
  const { data: tournament, isLoading: tLoading, error: tError } = useTournament(tournamentId)
  const { data: matches = [], isLoading: mLoading, error: mError } = useMatches(tournamentId)
  const { data: players = [], isLoading: pLoading, error: pError } = useTournamentPlayers(
    tournament?.participants ?? [],
  )
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const isLoading = tLoading || mLoading || pLoading
  const roundNumbers = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b)
  const totalMatches = matches.length
  const finishedMatches = matches.filter((m) => m.status === 'finished').length
  const isOrganizer = user && tournament?.createdBy === user.uid
  const canForceComplete = tournament?.status === 'in_progress' && isOrganizer

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
        </div>
      )}
    </main>
  )
}
