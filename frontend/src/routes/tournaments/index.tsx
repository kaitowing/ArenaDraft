import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Loader2, LogIn, Plus, Trophy, RefreshCw } from 'lucide-react'
import { AuthGuard } from '#/features/auth/AuthGuard'
import { TournamentCard } from '#/features/tournaments/TournamentCard'
import { useTournamentsRealtime, type TournamentDateFilter } from '#/features/tournaments/tournamentQueries'
import { joinTournamentByCode } from '#/features/tournaments/tournamentService'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Skeleton } from '#/components/ui/skeleton'
import { useToast } from '#/hooks/useToast'
import { useAuth } from '#/features/auth/useAuth'
import { useQueryClient } from '@tanstack/react-query'

 const PAGE_SIZE = 10

 const DATE_FILTER_OPTIONS: Array<{ value: TournamentDateFilter; label: string }> = [
   { value: 'last30days', label: 'Últimos 30 dias' },
   { value: 'thisMonth', label: 'Este mês' },
   { value: 'thisYear', label: 'Este ano' },
   { value: 'all', label: 'Todo o histórico' },
 ]

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
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [dateFilter, setDateFilter] = useState<TournamentDateFilter>('last30days')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const { data, isLoading } = useTournamentsRealtime({ dateFilter, visibleCount })
  const tournaments = data?.tournaments ?? []
  const hasMore = data?.hasMore ?? false

  function handleDateFilterChange(nextFilter: TournamentDateFilter) {
    setDateFilter(nextFilter)
    setVisibleCount(PAGE_SIZE)
  }

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

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await queryClient.invalidateQueries({ queryKey: ['tournaments-realtime'] })
      toast({ title: 'Lista atualizada!' })
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao atualizar', description: String(err) })
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 pb-28 pt-6 flex flex-col h-screen">
      {/* Fixed header section */}
      <div className="flex-shrink-0">
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
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {isLoading
                ? 'Carregando torneios...'
                : hasMore
                  ? `Exibindo ${tournaments.length} torneios deste filtro.`
                  : `${tournaments.length} torneio${tournaments.length !== 1 ? 's' : ''} neste filtro.`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              className="rounded-2xl"
              title="Atualizar lista"
            >
              <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Link to="/tournaments/new">
              <Button className="gap-1.5 rounded-2xl bg-[var(--cta-primary)] px-6 text-base hover:bg-[var(--cta-primary-dark)]">
                <Plus className="size-4" />
                Novo
              </Button>
            </Link>
          </div>
        </div>

        <div className="mb-4 rise-in" style={{ animationDelay: '40ms' }}>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Período
          </label>
          <div className="relative">
            <select
              value={dateFilter}
              onChange={(e) => handleDateFilterChange(e.target.value as TournamentDateFilter)}
              className="w-full appearance-none rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--sea-ink)] focus:outline-none"
            >
              {DATE_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Scrollable tournaments list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ scrollBehavior: 'smooth' }}>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-3xl" />
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="surf-card texture-noise flex flex-col items-center gap-3 rounded-3xl px-6 py-16 text-center text-[var(--text-muted)]">
            <Trophy className="size-12 text-[var(--cta-primary)]" />
            <p className="text-sm">Nenhum torneio encontrado para o período selecionado.</p>
            <Link to="/tournaments/new" className="text-sm font-semibold text-[var(--cta-primary)] underline underline-offset-4">
              Criar primeiro torneio
            </Link>
          </div>
        ) : (
          <div className="space-y-4 rise-in" style={{ animationDelay: '80ms' }}>
            <div className="space-y-3">
              {tournaments.map((t) => (
                <TournamentCard key={t.id} tournament={t} />
              ))}
            </div>
            {hasMore && (
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-2xl"
                onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
              >
                Carregar mais torneios
              </Button>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
