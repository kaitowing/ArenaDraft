import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, query, where } from 'firebase/firestore'
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
