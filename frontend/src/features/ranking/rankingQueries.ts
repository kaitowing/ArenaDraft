import { useQuery, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, limit, onSnapshot, query, where } from 'firebase/firestore'
import { useEffect, useRef } from 'react'
import { db } from '#/lib/firebase'
import type { AppUser, MedalAward } from '#/types'

export const GLOBAL_CITY = 'GLOBAL'

export function useRanking(cityId: string = GLOBAL_CITY) {
  return useQuery({
    queryKey: ['ranking', cityId],
    queryFn: async () => {
      const q =
        cityId === GLOBAL_CITY
          ? query(collection(db, 'users'))
          : query(collection(db, 'users'), where('cities', 'array-contains', cityId))
      const snapshot = await getDocs(q)
      return snapshot.docs
        .map((d) => d.data() as AppUser)
        .sort((a, b) => b.mmr - a.mmr)
    },
  })
}

export function usePlayerProfile(uid: string) {
  return useQuery({
    queryKey: ['player-profile', uid],
    queryFn: async () => {
      const q = query(collection(db, 'users'), where('uid', '==', uid), limit(1))
      const snapshot = await getDocs(q)
      if (snapshot.empty) return null
      return snapshot.docs[0].data() as AppUser
    },
    enabled: !!uid,
  })
}

export function useMedals(uid: string) {
  return useQuery({
    queryKey: ['medals', uid],
    queryFn: async () => {
      const q = query(collection(db, 'medals'), where('uid', '==', uid))
      const snapshot = await getDocs(q)
      return snapshot.docs
        .map((d) => d.data() as MedalAward)
        .sort((a, b) => b.awardedAt.toMillis() - a.awardedAt.toMillis())
    },
    enabled: !!uid,
  })
}

export function useTournamentMedals(tournamentId: string) {
  return useQuery({
    queryKey: ['tournament-medals', tournamentId],
    queryFn: async () => {
      const q = query(collection(db, 'medals'), where('tournamentId', '==', tournamentId))
      const snapshot = await getDocs(q)
      return snapshot.docs
        .map((d) => d.data() as MedalAward)
        .sort((a, b) => b.awardedAt.toMillis() - a.awardedAt.toMillis())
    },
    enabled: !!tournamentId,
  })
}

export function useRankingRealtime(cityId: string = GLOBAL_CITY) {
  const queryClient = useQueryClient()
  const initializedRef = useRef(false)

  const result = useQuery({
    queryKey: ['ranking-realtime', cityId],
    queryFn: async () => {
      const q =
        cityId === GLOBAL_CITY
          ? query(collection(db, 'users'))
          : query(collection(db, 'users'), where('cities', 'array-contains', cityId))
      const snapshot = await getDocs(q)
      return snapshot.docs
        .map((d) => d.data() as AppUser)
        .sort((a, b) => b.mmr - a.mmr)
    },
    staleTime: Infinity,
    gcTime: 1000 * 60 * 5,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    const q =
      cityId === GLOBAL_CITY
        ? query(collection(db, 'users'))
        : query(collection(db, 'users'), where('cities', 'array-contains', cityId))
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!initializedRef.current) {
        initializedRef.current = true
        return
      }
      const playerList = snapshot.docs
        .map((d) => d.data() as AppUser)
        .sort((a, b) => b.mmr - a.mmr)
      queryClient.setQueryData(['ranking-realtime', cityId], playerList)
    })

    return () => {
      unsubscribe()
      initializedRef.current = false
    }
  }, [cityId, queryClient])

  return result
}

export function useRankingSearchFallback(searchTerm: string, enabled: boolean) {
  return useQuery({
    queryKey: ['ranking-search-fallback', searchTerm],
    queryFn: async () => {
      const trimmedTerm = searchTerm.trim()
      if (!trimmedTerm) return []

      const snapshot = await getDocs(query(collection(db, 'users')))
      const normalizedSearchTerm = trimmedTerm.toLocaleLowerCase('pt-BR')

      return snapshot.docs
        .map((d) => d.data() as AppUser)
        .filter((player) => player.displayName.toLocaleLowerCase('pt-BR').includes(normalizedSearchTerm))
        .sort((a, b) => b.mmr - a.mmr)
    },
    enabled,
    staleTime: 1000 * 30,
  })
}
