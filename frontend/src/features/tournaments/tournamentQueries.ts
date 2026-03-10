import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore'
import { useEffect, useRef } from 'react'
import { db } from '#/lib/firebase'
import type { AppUser, City, Tournament } from '#/types'

 export type TournamentDateFilter = 'last30days' | 'thisMonth' | 'thisYear' | 'all'

 function getTournamentDateThreshold(dateFilter: TournamentDateFilter) {
   const now = new Date()

   if (dateFilter === 'last30days') {
     const date = new Date(now)
     date.setDate(date.getDate() - 30)
     return Timestamp.fromDate(date)
   }

   if (dateFilter === 'thisMonth') {
     return Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), 1))
   }

   if (dateFilter === 'thisYear') {
     return Timestamp.fromDate(new Date(now.getFullYear(), 0, 1))
   }

   return null
 }

export function useTournaments() {
  return useQuery({
    queryKey: ['tournaments'],
    queryFn: async () => {
      const q = query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'))
      const snapshot = await getDocs(q)
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Tournament)
    },
  })
}

export function useTournament(tournamentId: string) {
  return useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: async () => {
      const ref = doc(db, 'tournaments', tournamentId)
      const snap = await getDoc(ref)
      if (!snap.exists()) throw new Error('Torneio não encontrado')
      return { id: snap.id, ...snap.data() } as Tournament
    },
    enabled: !!tournamentId,
  })
}

export function useTournamentRealtime(tournamentId: string) {
  const queryClient = useQueryClient()
  const initializedRef = useRef(false)

  const result = useQuery({
    queryKey: ['tournament-realtime', tournamentId],
    queryFn: async () => {
      const ref = doc(db, 'tournaments', tournamentId)
      const snap = await getDoc(ref)
      if (!snap.exists()) throw new Error('Torneio não encontrado')
      return { id: snap.id, ...snap.data() } as Tournament
    },
    enabled: !!tournamentId,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 5,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (!tournamentId) return

    const ref = doc(db, 'tournaments', tournamentId)
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (!initializedRef.current) {
        initializedRef.current = true
        return
      }
      if (snap.exists()) {
        queryClient.setQueryData(['tournament-realtime', tournamentId], { id: snap.id, ...snap.data() } as Tournament)
      }
    })

    return () => {
      unsubscribe()
      initializedRef.current = false
    }
  }, [tournamentId, queryClient])

  return result
}

export function useTournamentPlayers(uids: string[]) {
  const key = [...uids].sort().join(',')
  return useQuery({
    queryKey: ['tournament-players', key],
    queryFn: async () => {
      if (uids.length === 0) return []
      const q = query(collection(db, 'users'), where('uid', 'in', uids))
      const snapshot = await getDocs(q)
      return snapshot.docs.map((d) => d.data() as AppUser)
    },
    enabled: uids.length > 0,
  })
}

export function useAllPlayers() {
  return useQuery({
    queryKey: ['all-players'],
    queryFn: async () => {
      const q = query(collection(db, 'users'), orderBy('displayName'))
      const snapshot = await getDocs(q)
      return snapshot.docs.map((d) => d.data() as AppUser)
    },
  })
}

export function useTournamentByCode(code: string) {
  return useQuery({
    queryKey: ['tournament-by-code', code],
    queryFn: async () => {
      if (!code) return null
      const q = query(
        collection(db, 'tournaments'),
        where('joinCode', '==', code.toUpperCase().trim()),
        where('status', '==', 'waiting'),
        limit(1),
      )
      const snapshot = await getDocs(q)
      if (snapshot.empty) return null
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Tournament
    },
    enabled: code.length >= 6,
  })
}

export function useCities() {
  return useQuery({
    queryKey: ['cities'],
    queryFn: async () => {
      const snapshot = await getDocs(collection(db, 'cities'))
      const cities = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as City)
      return cities
        .filter((c) => c.active)
        .sort((a, b) => {
          const ao = typeof a.order === 'number' ? a.order : Number(a.order ?? NaN)
          const bo = typeof b.order === 'number' ? b.order : Number(b.order ?? NaN)
          const aHas = Number.isFinite(ao)
          const bHas = Number.isFinite(bo)

          if (aHas && bHas && ao !== bo) return ao - bo
          if (aHas !== bHas) return aHas ? -1 : 1
          return a.name.localeCompare(b.name, 'pt-BR')
        })
    },
    staleTime: 1000 * 60 * 10,
  })
}

export function useTournamentsRealtime({
  dateFilter = 'last30days',
  visibleCount = 10,
}: {
  dateFilter?: TournamentDateFilter
  visibleCount?: number
} = {}) {
  const queryClient = useQueryClient()
  const initializedRef = useRef(false)
  const queryLimit = visibleCount + 1
  const threshold = getTournamentDateThreshold(dateFilter)

  const result = useQuery({
    queryKey: ['tournaments-realtime', dateFilter, visibleCount],
    queryFn: async () => {
      const q = threshold
        ? query(
            collection(db, 'tournaments'),
            where('createdAt', '>=', threshold),
            orderBy('createdAt', 'desc'),
            limit(queryLimit),
          )
        : query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'), limit(queryLimit))
      const snapshot = await getDocs(q)
      const tournaments = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Tournament)
      return {
        tournaments: tournaments.slice(0, visibleCount),
        hasMore: tournaments.length > visibleCount,
      }
    },
    staleTime: Infinity,
    gcTime: 1000 * 60 * 5,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    const q = threshold
      ? query(
          collection(db, 'tournaments'),
          where('createdAt', '>=', threshold),
          orderBy('createdAt', 'desc'),
          limit(queryLimit),
        )
      : query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'), limit(queryLimit))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!initializedRef.current) {
        initializedRef.current = true
        return
      }
      const tournaments = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Tournament)
      queryClient.setQueryData(['tournaments-realtime', dateFilter, visibleCount], {
        tournaments: tournaments.slice(0, visibleCount),
        hasMore: tournaments.length > visibleCount,
      })
    })

    return () => {
      unsubscribe()
      initializedRef.current = false
    }
  }, [dateFilter, queryClient, queryLimit, threshold, visibleCount])

  return result
}

export function useAppUserRealtime(uid: string | undefined) {
  const queryClient = useQueryClient()
  const initializedRef = useRef(false)

  const result = useQuery({
    queryKey: ['appUser-realtime', uid],
    queryFn: async () => {
      if (!uid) return null
      const q = query(collection(db, 'users'), where('uid', '==', uid), limit(1))
      const snapshot = await getDocs(q)
      return snapshot.empty ? null : (snapshot.docs[0].data() as AppUser)
    },
    enabled: !!uid,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 5,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (!uid) return

    const q = query(collection(db, 'users'), where('uid', '==', uid), limit(1))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!initializedRef.current) {
        initializedRef.current = true
        return
      }
      const appUser = snapshot.empty ? null : (snapshot.docs[0].data() as AppUser)
      queryClient.setQueryData(['appUser-realtime', uid], appUser)
    })

    return () => {
      unsubscribe()
      initializedRef.current = false
    }
  }, [uid, queryClient])

  return result
}
