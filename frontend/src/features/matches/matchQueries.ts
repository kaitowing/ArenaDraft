import { useQuery, useQueryClient } from '@tanstack/react-query'
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { useEffect, useRef } from 'react'
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

export function useMatchesRealtime(tournamentId: string, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true
  const queryClient = useQueryClient()
  const initializedRef = useRef(false)

  const result = useQuery({
    queryKey: ['matches-realtime', tournamentId],
    queryFn: async () => {
      const q = query(collection(db, 'matches'), where('tournamentId', '==', tournamentId))
      const snapshot = await getDocs(q)
      return snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Match)
        .sort((a, b) => a.round - b.round)
    },
    enabled: !!tournamentId && enabled,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 5,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (!tournamentId || !enabled) return

    const q = query(collection(db, 'matches'), where('tournamentId', '==', tournamentId))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!initializedRef.current) {
        initializedRef.current = true
        return
      }
      const matchList = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Match)
        .sort((a, b) => a.round - b.round)
      queryClient.setQueryData(['matches-realtime', tournamentId], matchList)
    })

    return () => {
      unsubscribe()
      initializedRef.current = false
    }
  }, [tournamentId, enabled, queryClient])

  return result
}

export function useMatchRealtime(matchId: string) {
  const queryClient = useQueryClient()
  const initializedRef = useRef(false)

  const result = useQuery({
    queryKey: ['match-realtime', matchId],
    queryFn: async () => {
      const ref = doc(db, 'matches', matchId)
      const snap = await getDoc(ref)
      if (!snap.exists()) throw new Error('Partida não encontrada')
      return { id: snap.id, ...snap.data() } as Match
    },
    enabled: !!matchId,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 5,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (!matchId) return

    const ref = doc(db, 'matches', matchId)
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (!initializedRef.current) {
        initializedRef.current = true
        return
      }
      if (snap.exists()) {
        queryClient.setQueryData(['match-realtime', matchId], { id: snap.id, ...snap.data() } as Match)
      }
    })

    return () => {
      unsubscribe()
      initializedRef.current = false
    }
  }, [matchId, queryClient])

  return result
}
