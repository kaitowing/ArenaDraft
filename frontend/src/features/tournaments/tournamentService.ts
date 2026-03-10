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
import type { AppUser, Tournament } from '#/types'
import { generateRoundRobin } from './algorithms'

function generateJoinCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export async function createTournamentLobby(createdBy: string, isRoundTrip = false, name = 'Torneio do Dia'): Promise<string> {
  const tournamentRef = doc(collection(db, 'tournaments'))
  const tournamentData: Omit<Tournament, 'id'> = {
    name,
    date: new Date().toISOString().split('T')[0],
    status: 'waiting',
    createdBy,
    joinCode: generateJoinCode(),
    participants: [createdBy],
    winnerTeam: null,
    isRoundTrip,
    createdAt: serverTimestamp() as Tournament['createdAt'],
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
): Promise<void> {
  const batch = writeBatch(db)
  const tournamentRef = doc(db, 'tournaments', tournamentId)

  batch.update(tournamentRef, { status: 'in_progress' })

  const tournamentSnap = await getDoc(tournamentRef)
  const tournament = { id: tournamentSnap.id, ...tournamentSnap.data() } as Tournament

  const matches = generateRoundRobin(pairs, tournamentId, tournament.isRoundTrip)
  for (const match of matches) {
    const matchRef = doc(collection(db, 'matches'))
    batch.set(matchRef, match)
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
