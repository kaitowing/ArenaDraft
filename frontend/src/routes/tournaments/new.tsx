import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Loader2, Trophy, Shuffle, Layers, Swords, Dices } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { AuthGuard } from '#/features/auth/AuthGuard'
import { createTournamentLobby } from '#/features/tournaments/tournamentService'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { useToast } from '#/hooks/useToast'
import { useAuth } from '#/features/auth/useAuth'
import type { TournamentCategory, TournamentFormat } from '#/types'

export const Route = createFileRoute('/tournaments/new')({ component: NewTournamentPage })

function NewTournamentPage() {
  return (
    <AuthGuard>
      <NewTournamentContent />
    </AuthGuard>
  )
}

function NewTournamentContent() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [isRoundTrip, setIsRoundTrip] = useState(false)
  const [randomPairs, setRandomPairs] = useState(false)
  const [tournamentName, setTournamentName] = useState('')
  const [format, setFormat] = useState<TournamentFormat>('round_robin')
  const [category, setCategory] = useState<TournamentCategory>('open')
  const [groupCount, setGroupCount] = useState(2)
  const [advancePerGroup, setAdvancePerGroup] = useState(2)

  async function handleCreate() {
    if (!user) return
    const name = tournamentName.trim() || 'Torneio do Dia'
    setCreating(true)
    try {
      const tournamentId = await createTournamentLobby(user.uid, {
        name,
        isRoundTrip,
        randomPairs,
        format,
        category,
        groupCount,
        advancePerGroup,
      })
      await queryClient.invalidateQueries({ queryKey: ['tournaments-realtime'] })
      void navigate({ to: '/tournaments/$tournamentId', params: { tournamentId } })
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao criar torneio', description: String(err) })
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 pb-28 pt-6 flex flex-col items-center justify-center min-h-[70vh]">
      <div className="text-center rise-in mb-8">
        <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-full bg-[var(--foam)] mb-4">
          <Trophy className="size-10 text-[var(--lagoon-deep)]" />
        </div>
        <h1 className="display-title text-2xl font-bold text-[var(--sea-ink)] mb-2">Novo Torneio</h1>
        <p className="text-sm text-[var(--sea-ink-soft)] max-w-xs mx-auto mb-6">
          Crie um lobby e compartilhe o código com os jogadores. Quando todos estiverem prontos, você inicia o sorteio.
        </p>

        {/* Tournament name input */}
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-4 mb-6">
          <label htmlFor="tournament-name" className="block text-sm font-semibold text-[var(--sea-ink)] mb-2">
            Nome do torneio
          </label>
          <Input
            id="tournament-name"
            type="text"
            placeholder="Torneio do Dia"
            value={tournamentName}
            onChange={(e) => setTournamentName(e.target.value)}
            className="w-full"
            maxLength={50}
          />
          <p className="text-xs text-[var(--sea-ink-soft)] mt-1">
            Deixe vazio para usar "Torneio do Dia"
          </p>
        </div>

        {/* Format selection */}
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-4 mb-6 space-y-4">
          <div className="flex items-center gap-2">
            <Shuffle className="size-4 text-[var(--lagoon-deep)]" />
            <div>
              <p className="text-sm font-semibold text-[var(--sea-ink)]">Formato do torneio</p>
              <p className="text-xs text-[var(--sea-ink-soft)]">Escolha todos contra todos ou clássico (grupos + mata-mata).</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: 'round_robin' as TournamentFormat, title: 'Todos x Todos', description: 'Uma fase, ranking geral.' },
              { value: 'classic' as TournamentFormat, title: 'Clássico', description: 'Grupos + eliminatórias.' },
            ]).map((option) => {
              const active = format === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormat(option.value)}
                  className={`rounded-2xl border px-3 py-3 text-left transition-all cursor-pointer ${
                    active
                      ? 'border-[var(--lagoon-deep)] bg-[var(--foam)] text-[var(--sea-ink)] shadow'
                      : 'border-[var(--line)] text-[var(--sea-ink-soft)] hover:border-[var(--lagoon)]'
                  }`}
                >
                  <p className="text-sm font-semibold">{option.title}</p>
                  <p className="text-xs">{option.description}</p>
                </button>
              )
            })}
          </div>
          <div className="border-t border-dashed border-[var(--line)] pt-4 space-y-3">
            <p className="text-sm font-semibold text-[var(--sea-ink)] flex items-center gap-2">
              <Layers className="size-4" /> Categoria
            </p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'open' as TournamentCategory, label: 'Livre' },
                { value: 'unisex' as TournamentCategory, label: 'Unissex' },
                { value: 'mixed' as TournamentCategory, label: 'Misto' },
              ]).map((option) => {
                const active = category === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCategory(option.value)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-all cursor-pointer ${
                      active
                        ? 'border-[var(--lagoon-deep)] bg-[var(--foam)] text-[var(--lagoon-deep)]'
                        : 'border-[var(--line)] text-[var(--sea-ink-soft)] hover:border-[var(--lagoon)]'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
          {format === 'round_robin' && (
            <div className="space-y-3 border-t border-dashed border-[var(--line)] pt-4">
              {/* Random Pairs toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Dices className="size-4 shrink-0 text-[var(--lagoon-deep)]" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--sea-ink)]">Duplas aleatórias</p>
                    <p className="text-xs text-[var(--sea-ink-soft)]">
                      A cada rodada as duplas são sorteadas. Ninguém joga com o mesmo parceiro duas vezes.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !randomPairs
                    setRandomPairs(next)
                    if (next) setIsRoundTrip(false)
                  }}
                  className={`ml-3 relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    randomPairs ? 'bg-[var(--lagoon-deep)]' : 'bg-[var(--sea-ink-soft)]'
                  }`}
                >
                  <span
                    className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                      randomPairs ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Round-trip toggle — hidden when random pairs is on */}
              {!randomPairs && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--sea-ink)]">Ida e volta</p>
                    <p className="text-xs text-[var(--sea-ink-soft)]">Cada dupla joga duas vezes.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRoundTrip(!isRoundTrip)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      isRoundTrip ? 'bg-[var(--lagoon-deep)]' : 'bg-[var(--sea-ink-soft)]'
                    }`}
                  >
                    <span
                      className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                        isRoundTrip ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>
          )}
          {format === 'classic' && (
            <div className="grid grid-cols-2 gap-3 border-t border-dashed border-[var(--line)] pt-4">
              <label className="flex flex-col text-sm font-semibold text-[var(--sea-ink)]">
                Nº de grupos
                <Input
                  type="number"
                  min={2}
                  max={4}
                  value={groupCount}
                  onChange={(e) => setGroupCount(Math.max(2, Math.min(4, Number(e.target.value))))}
                  className="mt-1"
                />
              </label>
              <label className="flex flex-col text-sm font-semibold text-[var(--sea-ink)]">
                Classificados/grupo
                <Input
                  type="number"
                  min={1}
                  max={4}
                  value={advancePerGroup}
                  onChange={(e) => setAdvancePerGroup(Math.max(1, Math.min(4, Number(e.target.value))))}
                  className="mt-1"
                />
              </label>
              <p className="col-span-2 text-xs text-[var(--sea-ink-soft)] flex items-center gap-2">
                <Swords className="size-3" /> Eliminatórias formadas com {groupCount * advancePerGroup} equipes.
              </p>
            </div>
          )}
        </div>
      </div>

      <Button
        size="lg"
        className="w-full max-w-xs shadow-xl"
        onClick={handleCreate}
        disabled={creating}
      >
        {creating ? <Loader2 className="size-4 animate-spin" /> : 'Criar lobby'}
      </Button>
    </main>
  )
}
