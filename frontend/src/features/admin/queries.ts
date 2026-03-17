import { useEffect } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import type { DocumentSnapshot } from 'firebase/firestore'
import {
  fetchAdminTournaments,
  type AdminTournamentFilters,
} from '#/features/admin/adminService'

export function useAdminTournamentsInfiniteQuery({
  filters,
  searchVersion,
  toast,
}: {
  filters: AdminTournamentFilters | null
  searchVersion: number
  toast: (options: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void
}) {
  const query = useInfiniteQuery({
    queryKey: ['admin-tournaments', searchVersion, filters],
    enabled: filters !== null,
    initialPageParam: null as DocumentSnapshot | null,
    queryFn: ({ pageParam }) =>
      fetchAdminTournaments(filters ?? {}, (pageParam as DocumentSnapshot | null | undefined) ?? null),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.lastDoc : undefined),
  })

  useEffect(() => {
    if (!query.error) return
    toast({
      variant: 'destructive',
      title: 'Erro ao buscar torneios',
      description: String(query.error),
    })
  }, [query.error, toast])

  return query
}
