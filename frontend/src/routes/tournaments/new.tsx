import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Loader2, Trophy } from 'lucide-react'
import { AuthGuard } from '#/features/auth/AuthGuard'
import { createTournamentLobby } from '#/features/tournaments/tournamentService'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { useToast } from '#/hooks/useToast'
import { useAuth } from '#/features/auth/useAuth'

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
  const [creating, setCreating] = useState(false)
  const [isRoundTrip, setIsRoundTrip] = useState(false)
  const [tournamentName, setTournamentName] = useState('')

  async function handleCreate() {
    if (!user) return
    const name = tournamentName.trim() || 'Torneio do Dia'
    setCreating(true)
    try {
      const tournamentId = await createTournamentLobby(user.uid, isRoundTrip, name)
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

        {/* Round-trip toggle */}
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="text-left">
              <p className="text-sm font-semibold text-[var(--sea-ink)]">Ida e volta</p>
              <p className="text-xs text-[var(--sea-ink-soft)]">
                Cada dupla joga duas vezes (ida e volta)
              </p>
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
