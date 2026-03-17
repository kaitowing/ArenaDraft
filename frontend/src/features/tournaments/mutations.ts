import { useMutation, useQueryClient } from '@tanstack/react-query'
import { joinTournamentByCode, addParticipantByOrganizer } from '#/features/tournaments/tournamentService'

export function useJoinTournamentMutation({
  code,
  userId,
  toast,
  onSuccess,
}: {
  code: string
  userId: string | undefined
  toast: (options: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void
  onSuccess?: (tournamentId: string) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Usuário não autenticado.')
      return joinTournamentByCode(code, userId)
    },
    onSuccess: async (tournamentId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tournaments'] }),
        queryClient.invalidateQueries({ queryKey: ['tournaments-realtime'] }),
        queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] }),
        queryClient.invalidateQueries({ queryKey: ['tournament-realtime', tournamentId] }),
        queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] }),
        queryClient.invalidateQueries({ queryKey: ['matches-realtime', tournamentId] }),
        queryClient.invalidateQueries({ queryKey: ['tournament-players'] }),
      ])

      onSuccess?.(tournamentId)
    },
    onError: (err) => {
      toast({ variant: 'destructive', title: 'Código inválido', description: String(err) })
    },
  })
}

export function useAddParticipantByOrganizerMutation({
  tournamentId,
  organizerUid,
  toast,
  onSuccess,
}: {
  tournamentId: string
  organizerUid: string | undefined
  toast: (options: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void
  onSuccess?: () => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (targetUid: string) => {
      if (!organizerUid) throw new Error('Usuário não autenticado.')
      return addParticipantByOrganizer(tournamentId, organizerUid, targetUid)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tournament-realtime', tournamentId] }),
        queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] }),
        queryClient.invalidateQueries({ queryKey: ['tournament-players'] }),
      ])
      toast({ title: 'Jogador adicionado ao torneio!' })
      onSuccess?.()
    },
    onError: (err) => {
      toast({ variant: 'destructive', title: 'Erro ao adicionar jogador', description: String(err) })
    },
  })
}
