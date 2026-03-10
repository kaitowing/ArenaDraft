import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Globe, MapPin, Plus, Search } from 'lucide-react'
import { AuthGuard } from '#/features/auth/AuthGuard'
import { useRankingRealtime, useRankingSearchFallback, GLOBAL_CITY } from '#/features/ranking/rankingQueries'
import { useCities, useAppUserRealtime } from '#/features/tournaments/tournamentQueries'
import { RankingTable } from '#/features/ranking/RankingTable'
import { useAuth } from '#/features/auth/useAuth'
import { Input } from '#/components/ui/input'
import { Button } from '#/components/ui/button'

export const Route = createFileRoute('/')({ component: Dashboard })

function Dashboard() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  )
}

function DashboardContent() {
  const { user } = useAuth()
  const [selectedCity, setSelectedCity] = useState<string>(GLOBAL_CITY)
  const [searchInput, setSearchInput] = useState('')
  const [submittedSearchTerm, setSubmittedSearchTerm] = useState('')

  const { data: appUser } = useAppUserRealtime(user?.uid)
  const { data: cities = [] } = useCities()
  const { data: players = [], isLoading } = useRankingRealtime(selectedCity)

  const userCityIds = appUser?.cities ?? []
  const userCities = cities.filter((c) => userCityIds.includes(c.id))
  const selectedCityName =
    selectedCity === GLOBAL_CITY
      ? 'Global'
      : (cities.find((c) => c.id === selectedCity)?.name ?? selectedCity)
  const normalizedSearchTerm = submittedSearchTerm.trim().toLocaleLowerCase('pt-BR')
  const filteredPlayers = normalizedSearchTerm.length === 0
    ? players
    : players.filter((player) => player.displayName.toLocaleLowerCase('pt-BR').includes(normalizedSearchTerm))
  const shouldUseFallback = normalizedSearchTerm.length > 0 && filteredPlayers.length === 0
  const { data: fallbackPlayers = [], isLoading: isFallbackLoading } = useRankingSearchFallback(
    submittedSearchTerm,
    shouldUseFallback,
  )
  const displayedPlayers = shouldUseFallback ? fallbackPlayers : filteredPlayers
  const rankingSource = shouldUseFallback ? fallbackPlayers : players

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmittedSearchTerm(searchInput.trim())
  }

  return (
    <main className="mx-auto max-w-lg px-4 pb-28 pt-6">
      <div className="mb-6 rise-in">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="display-title text-2xl font-bold text-[var(--sea-ink)]">
              Ranking {selectedCity === GLOBAL_CITY ? 'Global' : selectedCityName}
            </h1>
            <p className="text-sm text-[var(--sea-ink-soft)]">
              {normalizedSearchTerm.length > 0
                ? `${displayedPlayers.length} de ${rankingSource.length} jogador${rankingSource.length !== 1 ? 'es' : ''}`
                : `${players.length} jogador${players.length !== 1 ? 'es' : ''}`}
            </p>
          </div>

          {userCities.length > 0 && (
            <div className="relative">
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="appearance-none rounded-xl border border-[var(--line)] bg-[var(--header-bg)] pl-8 pr-3 py-1.5 text-sm font-medium text-[var(--sea-ink)] cursor-pointer focus:outline-none"
              >
                <option value={GLOBAL_CITY}>Global</option>
                {userCities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {selectedCity === GLOBAL_CITY
                ? <Globe className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-[var(--sea-ink-soft)]" />
                : <MapPin className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-[var(--sea-ink-soft)]" />
              }
            </div>
          )}
        </div>

        <form onSubmit={handleSearchSubmit} className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--sea-ink-soft)]" />
            <Input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar usuário por nome"
              className="pl-9"
            />
          </div>
          <Button type="submit" className="rounded-xl">
            Buscar
          </Button>
        </form>
      </div>

      <div className="rise-in" style={{ animationDelay: '80ms' }}>
        <RankingTable
          players={displayedPlayers}
          allPlayers={rankingSource}
          currentUserId={user?.uid}
          isLoading={isLoading || isFallbackLoading}
          searchTerm={submittedSearchTerm}
          totalPlayers={rankingSource.length}
        />
      </div>

      <Link to="/tournaments/new">
        <button
          type="button"
          className="fixed bottom-24 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--lagoon-deep)] text-white shadow-xl hover:bg-[var(--lagoon)] active:scale-95 transition-all cursor-pointer sm:right-6"
          aria-label="Criar torneio"
        >
          <Plus className="size-6" />
        </button>
      </Link>
    </main>
  )
}
