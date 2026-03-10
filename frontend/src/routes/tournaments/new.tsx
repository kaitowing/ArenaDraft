import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Loader2, Trophy } from 'lucide-react'
import { AuthGuard } from '#/features/auth/AuthGuard'
import { createTournamentLobby } from '#/features/tournaments/tournamentService'
import { Button } from '#/components/ui/button'
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

  async function handleCreate() {
    if (!user) return
    setCreating(true)
    try {
      const tournamentId = await createTournamentLobby(user.uid)
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
        <p className="text-sm text-[var(--sea-ink-soft)] max-w-xs mx-auto">
          Crie um lobby e compartilhe o código com os jogadores. Quando todos estiverem prontos, você inicia o sorteio.
        </p>
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
