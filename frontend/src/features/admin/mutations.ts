import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import {
  adminCancelTournament,
  reopenTournament,
  type AdminTournamentFilters,
  type AdminTournamentsPage,
} from '#/features/admin/adminService'
import type { Tournament } from '#/types'

function updateTournamentStatusInPages(
  current: InfiniteData<AdminTournamentsPage> | undefined,
  tournamentId: string,
  status: Tournament['status'],
) {
  if (!current) return current

  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      tournaments: page.tournaments.map((t) =>
        t.id === tournamentId ? { ...t, status } : t,
      ),
    })),
  }
}

export function useAdminCancelTournamentMutation({
  filters,
  searchVersion,
  toast,
}: {
  filters: AdminTournamentFilters | null
  searchVersion: number
  toast: (options: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void
}) {
  const queryClient = useQueryClient()
  const queryKey = ['admin-tournaments', searchVersion, filters] as const

  return useMutation({
    mutationFn: async (tournament: Tournament) => {
      await adminCancelTournament(tournament.id)
      return tournament
    },
    onSuccess: (tournament) => {
      toast({
        title: 'Torneio cancelado',
        description: `"${tournament.name}" foi cancelado e as métricas dos jogadores foram revertidas.`,
      })
      queryClient.setQueryData(
        queryKey,
        (current: InfiniteData<AdminTournamentsPage> | undefined) =>
          updateTournamentStatusInPages(current, tournament.id, 'cancelled'),
      )
    },
    onError: (err) => {
      toast({ variant: 'destructive', title: 'Erro ao cancelar torneio', description: String(err) })
    },
  })
}

export function useAdminReopenTournamentMutation({
  filters,
  searchVersion,
  toast,
}: {
  filters: AdminTournamentFilters | null
  searchVersion: number
  toast: (options: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void
}) {
  const queryClient = useQueryClient()
  const queryKey = ['admin-tournaments', searchVersion, filters] as const

  return useMutation({
    mutationFn: async (tournament: Tournament) => {
      await reopenTournament(tournament.id)
      return tournament
    },
    onSuccess: (tournament) => {
      toast({
        title: 'Torneio reaberto',
        description: `"${tournament.name}" voltou para Em andamento.`,
      })
      queryClient.setQueryData(
        queryKey,
        (current: InfiniteData<AdminTournamentsPage> | undefined) =>
          updateTournamentStatusInPages(current, tournament.id, 'in_progress'),
      )
    },
    onError: (err) => {
      toast({ variant: 'destructive', title: 'Erro ao reabrir torneio', description: String(err) })
    },
  })
}
