import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Globe, MapPin, Plus } from 'lucide-react'
import { AuthGuard } from '#/features/auth/AuthGuard'
import { useRankingRealtime, GLOBAL_CITY } from '#/features/ranking/rankingQueries'
import { useCities, useAppUserRealtime } from '#/features/tournaments/tournamentQueries'
import { RankingTable } from '#/features/ranking/RankingTable'
import { useAuth } from '#/features/auth/useAuth'

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

  const { data: appUser } = useAppUserRealtime(user?.uid)
  const { data: cities = [] } = useCities()
  const { data: players = [], isLoading } = useRankingRealtime(selectedCity)

  const userCityIds = appUser?.cities ?? []
  const userCities = cities.filter((c) => userCityIds.includes(c.id))
  const selectedCityName =
    selectedCity === GLOBAL_CITY
      ? 'Global'
      : (cities.find((c) => c.id === selectedCity)?.name ?? selectedCity)

  return (
    <main className="mx-auto max-w-lg px-4 pb-28 pt-6">
      <div className="mb-6 rise-in">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="display-title text-2xl font-bold text-[var(--sea-ink)]">
              Ranking {selectedCity === GLOBAL_CITY ? 'Global' : selectedCityName}
            </h1>
            <p className="text-sm text-[var(--sea-ink-soft)]">
              {players.length} jogador{players.length !== 1 ? 'es' : ''}
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
      </div>

      <div className="rise-in" style={{ animationDelay: '80ms' }}>
        <RankingTable players={players} currentUserId={user?.uid} isLoading={isLoading} />
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
