import { useQuery } from '@tanstack/react-query'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '#/lib/firebase'
import type { Match } from '#/types'

export function useMatches(tournamentId: string, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true
  return useQuery({
    queryKey: ['matches', tournamentId],
    queryFn: async () => {
      const q = query(collection(db, 'matches'), where('tournamentId', '==', tournamentId))
      const snapshot = await getDocs(q)
      return snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Match)
        .sort((a, b) => a.round - b.round)
    },
    enabled: !!tournamentId && enabled,
  })
}

export function useMatch(matchId: string) {
  return useQuery({
    queryKey: ['match', matchId],
    queryFn: async () => {
      const ref = doc(db, 'matches', matchId)
      const snap = await getDoc(ref)
      if (!snap.exists()) throw new Error('Partida não encontrada')
      return { id: snap.id, ...snap.data() } as Match
    },
    enabled: !!matchId,
  })
}
