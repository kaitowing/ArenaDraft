import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '#/lib/firebase'
import type { AppUser } from '#/types'

export const GLOBAL_CITY = 'GLOBAL'

export function useRanking(cityId: string = GLOBAL_CITY) {
  return useQuery({
    queryKey: ['ranking', cityId],
    queryFn: async () => {
      const constraints =
        cityId === GLOBAL_CITY
          ? [orderBy('mmr', 'desc')]
          : [where('cities', 'array-contains', cityId), orderBy('mmr', 'desc')]
      const q = query(collection(db, 'users'), ...constraints)
      const snapshot = await getDocs(q)
      return snapshot.docs.map((d) => d.data() as AppUser)
    },
  })
}
