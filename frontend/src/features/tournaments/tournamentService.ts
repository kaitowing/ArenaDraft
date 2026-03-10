import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  increment,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '#/lib/firebase'
import type { AppUser, Tournament, TournamentCategory, TournamentFormat } from '#/types'
import { buildGroupStage, generateRoundRobin } from './algorithms'
import { DEFAULT_TOURNAMENT_CATEGORY, DEFAULT_TOURNAMENT_FORMAT, getPairPolicy, validatePairForPolicy } from '#/lib/utils'

function generateJoinCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

interface CreateTournamentOptions {
  name?: string
  isRoundTrip?: boolean
  format?: TournamentFormat
  category?: TournamentCategory
  groupCount?: number
  advancePerGroup?: number
}

export async function createTournamentLobby(
  createdBy: string,
  { name = 'Torneio do Dia', isRoundTrip = false, format = DEFAULT_TOURNAMENT_FORMAT, category = DEFAULT_TOURNAMENT_CATEGORY, groupCount = 2, advancePerGroup = 2 }: CreateTournamentOptions = {},
): Promise<string> {
  const pairPolicy = getPairPolicy(category)
  const tournamentRef = doc(collection(db, 'tournaments'))
  const tournamentData: Partial<Omit<Tournament, 'id'>> = {
    name,
    date: new Date().toISOString().split('T')[0],
    status: 'waiting',
    createdBy,
    joinCode: generateJoinCode(),
    participants: [createdBy],
    winnerTeam: null,
    isRoundTrip,
    format,
    category,
    pairPolicy,
    bracketGenerated: false,
    createdAt: serverTimestamp() as Tournament['createdAt'],
  }

  if (format === 'classic') {
    const bracketSize = Math.max(advancePerGroup * groupCount, 0)
    tournamentData.groupCount = groupCount
    tournamentData.advancePerGroup = advancePerGroup
    tournamentData.bracketSize = bracketSize
  }

  const batch = writeBatch(db)
  batch.set(tournamentRef, tournamentData)
  await batch.commit()
  return tournamentRef.id
}

export async function joinTournamentByCode(
  code: string,
  uid: string,
): Promise<string> {
  const q = query(
    collection(db, 'tournaments'),
    where('joinCode', '==', code.toUpperCase().trim()),
    where('status', '==', 'waiting'),
    limit(1),
  )
  const snapshot = await getDocs(q)
  if (snapshot.empty) throw new Error('Torneio não encontrado ou já iniciado.')
  const tournamentRef = snapshot.docs[0].ref
  await updateDoc(tournamentRef, {
    participants: arrayUnion(uid),
  })
  return snapshot.docs[0].id
}

export async function startTournament(
  tournamentId: string,
  pairs: [AppUser, AppUser][],
  options?: { format?: TournamentFormat },
): Promise<void> {
  const batch = writeBatch(db)
  const tournamentRef = doc(db, 'tournaments', tournamentId)

  const tournamentSnap = await getDoc(tournamentRef)
  const tournament = { id: tournamentSnap.id, ...tournamentSnap.data() } as Tournament
  const format = options?.format ?? tournament.format ?? DEFAULT_TOURNAMENT_FORMAT
  const policy = tournament.pairPolicy ?? getPairPolicy(tournament.category ?? DEFAULT_TOURNAMENT_CATEGORY)

  const invalidPair = pairs.find((pair) => !validatePairForPolicy(pair, policy))
  if (invalidPair) {
    throw new Error('Há duplas que não respeitam a categoria escolhida. Ajuste antes de iniciar.')
  }

  batch.update(tournamentRef, { status: 'in_progress', format })

  if (format === 'round_robin') {
    const matches = generateRoundRobin(pairs, {
      tournamentId,
      isRoundTrip: tournament.isRoundTrip,
      stage: 'group',
    })
    for (const match of matches) {
      const matchRef = doc(collection(db, 'matches'))
      batch.set(matchRef, match)
    }
  } else {
    const groupCount = tournament.groupCount ?? 2
    const { groups, matches } = buildGroupStage(pairs, {
      tournamentId,
      groupCount,
      isRoundTrip: false,
    })
    batch.update(tournamentRef, { groups })
    for (const match of matches) {
      const matchRef = doc(collection(db, 'matches'))
      batch.set(matchRef, match)
    }
  }

  await batch.commit()
}

export async function updateTournamentStatus(
  tournamentId: string,
  status: Tournament['status'],
  winnerTeam?: [string, string],
) {
  const ref = doc(db, 'tournaments', tournamentId)
  await updateDoc(ref, {
    status,
    ...(winnerTeam ? { winnerTeam } : {}),
  })
}

export async function completeTournament(tournamentId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'tournaments', tournamentId)
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Torneio não encontrado')

    const tournament = { id: snap.id, ...snap.data() } as Tournament
    if (tournament.status === 'completed') return

    tx.update(ref, { status: 'completed' })

    for (const uid of tournament.participants ?? []) {
      tx.update(doc(db, 'users', uid), {
        'stats.tournamentsPlayed': increment(1),
      })
    }
  })
}

export async function forceCompleteTournament(tournamentId: string): Promise<void> {
  await completeTournament(tournamentId)
}

export async function cancelTournament(tournamentId: string): Promise<void> {
  const ref = doc(db, 'tournaments', tournamentId)
  await deleteDoc(ref)
}
