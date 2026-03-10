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
    <main className="mx-auto max-w-lg px-4 pb-28 pt-6">
      {/* Join by code */}
      <form onSubmit={handleJoin} className="mb-6 flex gap-2 rise-in">
        <Input
          placeholder="Código do torneio (ex: AB3X9Z)"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          className="font-mono tracking-widest uppercase"
        />
        <Button type="submit" disabled={joining || code.length < 6} className="shrink-0 gap-1.5">
          {joining ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
          Entrar
        </Button>
      </form>

      <div className="mb-6 flex items-center justify-between rise-in">
        <div>
          <h1 className="display-title text-2xl font-bold text-[var(--sea-ink)]">Torneios</h1>
          <p className="text-sm text-[var(--sea-ink-soft)]">Histórico de campeonatos</p>
        </div>
        <Link to="/tournaments/new">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-xl bg-[var(--lagoon-deep)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--lagoon)] active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="size-4" />
            Novo
          </button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : tournaments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-[var(--sea-ink-soft)]">
          <Trophy className="size-12 opacity-40" />
          <p className="text-sm">Nenhum torneio ainda.</p>
          <Link to="/tournaments/new">
            <span className="text-sm font-semibold text-[var(--lagoon-deep)] underline underline-offset-4 cursor-pointer">
              Criar primeiro torneio
            </span>
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
