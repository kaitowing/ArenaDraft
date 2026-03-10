import { useQuery, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { useEffect, useRef } from 'react'
import { db } from '#/lib/firebase'
import type { AppUser } from '#/types'

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
