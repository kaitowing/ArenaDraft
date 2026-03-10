import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Loader2, LogIn, Plus, Trophy } from 'lucide-react'
import { AuthGuard } from '#/features/auth/AuthGuard'
import { TournamentCard } from '#/features/tournaments/TournamentCard'
import { useTournaments } from '#/features/tournaments/tournamentQueries'
import { joinTournamentByCode } from '#/features/tournaments/tournamentService'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Skeleton } from '#/components/ui/skeleton'
import { useToast } from '#/hooks/useToast'
import { useAuth } from '#/features/auth/useAuth'
import { useQueryClient } from '@tanstack/react-query'

export const Route = createFileRoute('/tournaments/')({ component: TournamentsPage })

function TournamentsPage() {
  return (
    <AuthGuard>
      <TournamentsContent />
    </AuthGuard>
  )
}

function TournamentsContent() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: tournaments = [], isLoading } = useTournaments()
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setJoining(true)
    try {
      const tournamentId = await joinTournamentByCode(code, user.uid)

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tournaments'] }),
        queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] }),
        queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] }),
        queryClient.invalidateQueries({ queryKey: ['tournament-players'] }),
      ])

      void navigate({ to: '/tournaments/$tournamentId', params: { tournamentId } })
    } catch (err) {
      toast({ variant: 'destructive', title: 'Código inválido', description: String(err) })
    } finally {
      setJoining(false)
      setCode('')
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 pb-28 pt-6">
      {/* Join by code */}
      <form onSubmit={handleJoin} className="mb-6 rounded-3xl border border-[var(--wave-line)] bg-[color-mix(in_oklab,var(--shell)_86%,transparent)] px-4 py-3 shadow-sm backdrop-blur rise-in">
        <p className="sport-label text-[11px] text-[var(--text-muted)]">Código do torneio</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="EX: AB3X9Z"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="font-mono tracking-[0.5em] uppercase text-lg"
          />
          <Button type="submit" disabled={joining || code.length < 6} className="shrink-0 gap-1.5">
            {joining ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
            Entrar
          </Button>
        </div>
      </form>

      <div className="mb-6 flex items-center justify-between gap-3 rise-in">
        <div>
          <p className="sport-label text-xs text-[var(--text-muted)]">Histórico de campeonatos</p>
          <h1 className="display-title text-3xl font-bold text-[var(--text-heading)]">Torneios</h1>
        </div>
        <Link to="/tournaments/new">
          <Button className="gap-1.5 rounded-2xl bg-[var(--cta-primary)] px-6 text-base hover:bg-[var(--cta-primary-dark)]">
            <Plus className="size-4" />
            Novo
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-3xl" />
          ))}
        </div>
      ) : tournaments.length === 0 ? (
        <div className="surf-card texture-noise flex flex-col items-center gap-3 rounded-3xl px-6 py-16 text-center text-[var(--text-muted)]">
          <Trophy className="size-12 text-[var(--cta-primary)]" />
          <p className="text-sm">Nenhum torneio ainda.</p>
          <Link to="/tournaments/new" className="text-sm font-semibold text-[var(--cta-primary)] underline underline-offset-4">
            Criar primeiro torneio
          </Link>
        </div>
      ) : (
        <div className="space-y-3 rise-in" style={{ animationDelay: '80ms' }}>
          {tournaments.map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      )}
    </main>
  )
}
