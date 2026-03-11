import {
  collection,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  startAfter,
  where,
  writeBatch,
  type DocumentSnapshot,
  type QueryConstraint,
} from 'firebase/firestore'
import { db } from '#/lib/firebase'
import type { AppUser, Tournament } from '#/types'

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
