import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  query,
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

export async function createTournamentLobby(createdBy: string): Promise<string> {
  const tournamentRef = doc(collection(db, 'tournaments'))
  const tournamentData: Omit<Tournament, 'id'> = {
    date: new Date().toISOString().split('T')[0],
    status: 'waiting',
    createdBy,
    joinCode: generateJoinCode(),
    participants: [createdBy],
    winnerTeam: null,
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

  const matches = generateRoundRobin(pairs, tournamentId)
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
