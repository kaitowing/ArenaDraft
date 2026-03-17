import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateProfilePhoto, updateUserProfile } from '#/features/auth/authService'
import { compressImageToBase64 } from '#/lib/imageUtils'
import type { AppUser, Gender } from '#/types'

export interface ProfileUpdateInput {
  displayName: string
  cities: string[]
  gender: Gender | null
}

export function useSaveProfileMutation({
  uid,
  toast,
}: {
  uid: string | undefined
  toast: (options: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: ProfileUpdateInput) => {
      if (!uid) throw new Error('Usuário não autenticado.')
      await updateUserProfile(uid, updates)
      return updates
    },
    onSuccess: async (updates) => {
      if (!uid) return

      queryClient.setQueryData(['appUser-realtime', uid], (current: AppUser | null | undefined) =>
        current
          ? {
              ...current,
              displayName: updates.displayName,
              cities: updates.cities,
              gender: updates.gender,
            }
          : current,
      )

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['appUser-realtime', uid] }),
        queryClient.invalidateQueries({ queryKey: ['player-profile', uid] }),
        queryClient.invalidateQueries({ queryKey: ['ranking'] }),
        queryClient.invalidateQueries({ queryKey: ['ranking-realtime'] }),
        queryClient.invalidateQueries({ queryKey: ['all-players'] }),
      ])

      toast({ title: 'Perfil atualizado!' })
    },
    onError: (err) => {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: String(err) })
    },
  })
}

export function useUploadProfilePhotoMutation({
  uid,
  toast,
  onSuccess,
  onError,
}: {
  uid: string | undefined
  toast: (options: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void
  onSuccess?: () => void
  onError?: () => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      if (!uid) throw new Error('Usuário não autenticado.')
      const base64 = await compressImageToBase64(file)
      await updateProfilePhoto(uid, base64)
    },
    onSuccess: async () => {
      if (!uid) return
      await queryClient.invalidateQueries({ queryKey: ['profile-image', uid] })
      onSuccess?.()
      toast({ title: 'Foto atualizada!' })
    },
    onError: (err) => {
      onError?.()
      toast({ variant: 'destructive', title: 'Erro ao salvar foto', description: String(err) })
    },
  })
}
