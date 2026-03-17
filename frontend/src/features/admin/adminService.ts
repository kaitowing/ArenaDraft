import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  startAfter,
  updateDoc,
  where,
  writeBatch,
  type DocumentSnapshot,
  type QueryConstraint,
} from 'firebase/firestore'
import { db } from '#/lib/firebase'
import type { AppUser, Match, Tournament, UserRole } from '#/types'

// ─── Reopen Tournament ────────────────────────────────────────────────────────

/**
 * Reopens a completed tournament by setting its status back to `in_progress`
 * and decrementing `stats.tournamentsPlayed` for each participant, since the
 * tournament was not actually finished.
 */
export async function reopenTournament(tournamentId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'tournaments', tournamentId)
    const snap = await tx.get(ref)

    if (!snap.exists()) throw new Error('Torneio não encontrado.')

    const tournament = { id: snap.id, ...snap.data() } as Tournament

    if (tournament.status !== 'completed') {
      throw new Error(`Torneio não está encerrado (status atual: ${tournament.status}).`)
    }

    tx.update(ref, { status: 'in_progress' })

    for (const uid of tournament.participants ?? []) {
      tx.update(doc(db, 'users', uid), {
        'stats.tournamentsPlayed': increment(-1),
      })
    }
  })
}

// ─── Cancel Tournament (Admin) ───────────────────────────────────────────────

/**
 * Cancels an in-progress tournament without impacting player metrics.
 * - Reverts mmr, matchesWon and matchesLost for every finished match that
 *   has mmrDeltas stored (matches scored after this feature was deployed).
 * - Deletes all match documents for the tournament.
 * - Sets tournament status to `cancelled`.
 * NOTE: requires `allow delete: if isAdmin()` on /matches/{matchId} in
 * Firestore security rules for match deletion to succeed.
 */
export async function adminCancelTournament(tournamentId: string): Promise<void> {
  const tournamentRef = doc(db, 'tournaments', tournamentId)
  const tournamentSnap = await getDoc(tournamentRef)
  if (!tournamentSnap.exists()) throw new Error('Torneio não encontrado.')

  const tournament = { id: tournamentSnap.id, ...tournamentSnap.data() } as Tournament
  if (tournament.status !== 'in_progress') {
    throw new Error(`Torneio não está em andamento (status atual: ${tournament.status}).`)
  }

  const matchesSnap = await getDocs(
    query(collection(db, 'matches'), where('tournamentId', '==', tournamentId)),
  )
  const matches = matchesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Match)

  // Accumulate per-player reversals across all finished matches
  const mmrRevertByUid = new Map<string, number>()
  const winsRevertByUid = new Map<string, number>()
  const lossesRevertByUid = new Map<string, number>()

  for (const match of matches) {
    if (match.status !== 'finished' || !match.eloApplied) continue

    if (match.mmrDeltas && match.mmrDeltas.length > 0) {
      for (const d of match.mmrDeltas) {
        mmrRevertByUid.set(d.uid, (mmrRevertByUid.get(d.uid) ?? 0) + d.delta)
      }
    }

    const scoreA = match.teamA.score ?? 0
    const scoreB = match.teamB.score ?? 0
    if (scoreA === scoreB) continue
    const winnerIds: [string, string] = scoreA > scoreB ? match.teamA.playerIds : match.teamB.playerIds
    const loserIds: [string, string] = scoreA > scoreB ? match.teamB.playerIds : match.teamA.playerIds
    for (const uid of winnerIds) {
      winsRevertByUid.set(uid, (winsRevertByUid.get(uid) ?? 0) + 1)
    }
    for (const uid of loserIds) {
      lossesRevertByUid.set(uid, (lossesRevertByUid.get(uid) ?? 0) + 1)
    }
  }

  // Firestore batch limit is 500 ops. Typical tournament well within bounds.
  const batch = writeBatch(db)

  batch.update(tournamentRef, { status: 'cancelled' })

  for (const match of matches) {
    batch.delete(doc(db, 'matches', match.id))
  }

  const affectedUids = new Set([
    ...mmrRevertByUid.keys(),
    ...winsRevertByUid.keys(),
    ...lossesRevertByUid.keys(),
  ])
  for (const uid of affectedUids) {
    const update: Record<string, unknown> = {}
    const mmrDelta = mmrRevertByUid.get(uid)
    if (mmrDelta !== undefined) update['mmr'] = increment(-mmrDelta)
    const wins = winsRevertByUid.get(uid)
    if (wins !== undefined) update['stats.matchesWon'] = increment(-wins)
    const losses = lossesRevertByUid.get(uid)
    if (losses !== undefined) update['stats.matchesLost'] = increment(-losses)
    if (Object.keys(update).length > 0) {
      batch.update(doc(db, 'users', uid), update)
    }
  }

  await batch.commit()
}

// ─── Fetch Tournaments (Admin) ────────────────────────────────────────────────

export interface AdminTournamentFilters {
  status?: Tournament['status'] | 'all'
  dateFrom?: string // 'YYYY-MM-DD'
  dateTo?: string   // 'YYYY-MM-DD'
  tournamentId?: string
}

export interface AdminTournamentsPage {
  tournaments: Tournament[]
  lastDoc: DocumentSnapshot | null
  hasMore: boolean
}

const PAGE_SIZE = 20

export async function fetchAdminTournaments(
  filters: AdminTournamentFilters,
  pageAfter?: DocumentSnapshot | null,
): Promise<AdminTournamentsPage> {
  // If a specific tournament ID is requested, fetch directly
  if (filters.tournamentId?.trim()) {
    const ref = doc(db, 'tournaments', filters.tournamentId.trim())
    const snap = await runTransaction(db, async (tx) => tx.get(ref))
    if (!snap.exists()) return { tournaments: [], lastDoc: null, hasMore: false }
    const tournament = { id: snap.id, ...snap.data() } as Tournament
    return { tournaments: [tournament], lastDoc: null, hasMore: false }
  }

  const constraints: QueryConstraint[] = []

  if (filters.status && filters.status !== 'all') {
    constraints.push(where('status', '==', filters.status))
  }
  if (filters.dateFrom) {
    constraints.push(where('date', '>=', filters.dateFrom))
  }
  if (filters.dateTo) {
    constraints.push(where('date', '<=', filters.dateTo))
  }

  constraints.push(orderBy('date', 'desc'))
  constraints.push(orderBy('createdAt', 'desc'))

  if (pageAfter) {
    constraints.push(startAfter(pageAfter))
  }

  constraints.push(limit(PAGE_SIZE))

  const q = query(collection(db, 'tournaments'), ...constraints)
  const snapshot = await getDocs(q)

  const tournaments = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Tournament)
  const lastDoc = snapshot.docs[snapshot.docs.length - 1] ?? null

  return {
    tournaments,
    lastDoc,
    hasMore: snapshot.docs.length === PAGE_SIZE,
  }
}

// ─── Set User Role ────────────────────────────────────────────────────────────

/**
 * Updates the `role` field of a user document.
 * Only callable by ADMIN users (enforced client-side via AdminGuard).
 * Cannot be used to set/remove the ADMIN role — that must be done via Firebase Console.
 */
export async function setUserRole(targetUid: string, role: UserRole): Promise<void> {
  if (role === 'ADMIN') {
    throw new Error('Não é permitido promover usuários a ADMIN por aqui. Use o Firebase Console.')
  }
  const ref = doc(db, 'users', targetUid)
  await updateDoc(ref, { role })
}

// ─── Migrate User Roles ───────────────────────────────────────────────────────

export interface MigrateRolesResult {
  updated: number
  skipped: number
}

/**
 * Retroactively sets `role: 'USER'` on all user documents that don't have
 * the `role` field set yet. Safe to run multiple times (idempotent).
 */
export async function migrateUserRoles(): Promise<MigrateRolesResult> {
  // Firestore doesn't support "field does not exist" queries directly,
  // so we fetch all users and filter in-memory. For large datasets this
  // should be replaced with a Cloud Function, but it's fine for small apps.
  const snapshot = await getDocs(collection(db, 'users'))

  const docsToUpdate = snapshot.docs.filter((d) => {
    const data = d.data() as Partial<AppUser>
    return data.role == null
  })

  if (docsToUpdate.length === 0) {
    return { updated: 0, skipped: snapshot.docs.length }
  }

  // Firestore batch limit is 500 operations
  const BATCH_SIZE = 500
  let updated = 0

  for (let i = 0; i < docsToUpdate.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    const chunk = docsToUpdate.slice(i, i + BATCH_SIZE)
    for (const d of chunk) {
      batch.update(d.ref, { role: 'USER' })
    }
    await batch.commit()
    updated += chunk.length
  }

  return { updated, skipped: snapshot.docs.length - updated }
}
