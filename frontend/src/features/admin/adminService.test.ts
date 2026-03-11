/**
 * Integration tests for adminCancelTournament.
 *
 * Uses the real arenadrafthlg (staging) Firebase project with open security
 * rules. All documents are cleaned up via cleanupFirestore() in afterAll.
 */
import { describe, it, expect, afterAll, vi } from 'vitest'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore'
import { getTestDb, teardownTestApp, cleanupFirestore, makeTestUser } from '#/test/firebase-test-helpers'
import type { Match, Tournament, AppUser } from '#/types'

// ─── Inject test DB before the service module loads ───────────────────────────
vi.mock('#/lib/firebase', () => ({
  app: {},
  auth: {},
  db: getTestDb(),
}))

const { adminCancelTournament } = await import('./adminService')

// ─── Cleanup tracking ─────────────────────────────────────────────────────────
const createdTournamentIds: string[] = []
const createdUserIds: string[] = []

afterAll(async () => {
  const db = getTestDb()
  const batch = writeBatch(db)
  for (const uid of createdUserIds) {
    batch.delete(doc(db, 'users', uid))
  }
  await batch.commit()
  await cleanupFirestore(createdTournamentIds)
  await teardownTestApp()
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function seedUsers(users: AppUser[]): Promise<void> {
  const db = getTestDb()
  const batch = writeBatch(db)
  for (const u of users) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { createdAt: _omit, ...firestoreData } = u
    batch.set(doc(db, 'users', u.uid), firestoreData)
  }
  await batch.commit()
  createdUserIds.push(...users.map((u) => u.uid))
}

async function seedTournament(id: string, data: Partial<Tournament>): Promise<void> {
  const db = getTestDb()
  await writeBatch(db)
    .set(doc(db, 'tournaments', id), {
      name: 'Test Tournament',
      date: '2026-01-01',
      status: 'in_progress',
      createdBy: 'owner',
      joinCode: 'ABCDEF',
      participants: [],
      winnerTeam: null,
      isRoundTrip: false,
      format: 'round_robin',
      category: 'open',
      pairPolicy: 'any',
      randomPairs: false,
      bracketGenerated: false,
      ...data,
    })
    .commit()
  createdTournamentIds.push(id)
}

async function seedMatch(id: string, data: Partial<Match> & { tournamentId: string }): Promise<void> {
  const db = getTestDb()
  await writeBatch(db)
    .set(doc(db, 'matches', id), {
      round: 1,
      scoringFormat: 'points',
      status: 'pending',
      submittedBy: null,
      eloApplied: false,
      timestamp: null,
      stage: 'group',
      groupId: null,
      ...data,
    })
    .commit()
}

async function fetchTournament(id: string) {
  const snap = await getDoc(doc(getTestDb(), 'tournaments', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Tournament
}

async function fetchMatches(tournamentId: string) {
  const snap = await getDocs(
    query(collection(getTestDb(), 'matches'), where('tournamentId', '==', tournamentId)),
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Match)
}

async function fetchUser(uid: string) {
  const snap = await getDoc(doc(getTestDb(), 'users', uid))
  if (!snap.exists()) return null
  return snap.data() as AppUser
}

// ─── adminCancelTournament ────────────────────────────────────────────────────

describe('adminCancelTournament', () => {
  it('lança erro se o torneio não for in_progress', async () => {
    const tId = `test-cancel-not-inprogress-${Date.now()}`
    await seedTournament(tId, { status: 'completed' })

    await expect(adminCancelTournament(tId)).rejects.toThrow(
      /não está em andamento/,
    )
  })

  it('define status como cancelled e deleta partidas pendentes sem alterar métricas', async () => {
    const tId = `test-cancel-nomatches-${Date.now()}`
    const p1 = makeTestUser({ mmr: 1000, stats: { tournamentsPlayed: 0, matchesWon: 0, matchesLost: 0 } })
    const p2 = makeTestUser({ mmr: 1000, stats: { tournamentsPlayed: 0, matchesWon: 0, matchesLost: 0 } })
    const p3 = makeTestUser({ mmr: 1000, stats: { tournamentsPlayed: 0, matchesWon: 0, matchesLost: 0 } })
    const p4 = makeTestUser({ mmr: 1000, stats: { tournamentsPlayed: 0, matchesWon: 0, matchesLost: 0 } })
    await seedUsers([p1, p2, p3, p4])

    await seedTournament(tId, { participants: [p1.uid, p2.uid, p3.uid, p4.uid] })

    const mId = `match-pending-${Date.now()}`
    await seedMatch(mId, {
      tournamentId: tId,
      teamA: { playerIds: [p1.uid, p2.uid], score: null, mmrAverage: 1000 },
      teamB: { playerIds: [p3.uid, p4.uid], score: null, mmrAverage: 1000 },
      status: 'pending',
      eloApplied: false,
    } as unknown as Partial<Match> & { tournamentId: string })

    await adminCancelTournament(tId)

    const t = await fetchTournament(tId)
    expect(t?.status).toBe('cancelled')

    const remainingMatches = await fetchMatches(tId)
    expect(remainingMatches).toHaveLength(0)

    // No metrics should have changed
    const u1 = await fetchUser(p1.uid)
    expect(u1?.mmr).toBe(p1.mmr)
    expect(u1?.stats.matchesWon).toBe(0)
    expect(u1?.stats.matchesLost).toBe(0)
  })

  it('reverte mmr e vitórias/derrotas de partidas finalizadas com mmrDeltas', async () => {
    const tId = `test-cancel-revert-${Date.now()}`
    const p1 = makeTestUser({ mmr: 1030, stats: { tournamentsPlayed: 0, matchesWon: 1, matchesLost: 0 } })
    const p2 = makeTestUser({ mmr: 1025, stats: { tournamentsPlayed: 0, matchesWon: 1, matchesLost: 0 } })
    const p3 = makeTestUser({ mmr: 970,  stats: { tournamentsPlayed: 0, matchesWon: 0, matchesLost: 1 } })
    const p4 = makeTestUser({ mmr: 975,  stats: { tournamentsPlayed: 0, matchesWon: 0, matchesLost: 1 } })
    await seedUsers([p1, p2, p3, p4])

    await seedTournament(tId, { participants: [p1.uid, p2.uid, p3.uid, p4.uid] })

    // Simulate a finished match: p1+p2 beat p3+p4 with mmrDeltas stored
    const mId = `match-finished-${Date.now()}`
    await seedMatch(mId, {
      tournamentId: tId,
      teamA: { playerIds: [p1.uid, p2.uid], score: 6, mmrAverage: 1000 },
      teamB: { playerIds: [p3.uid, p4.uid], score: 2, mmrAverage: 1000 },
      status: 'finished',
      eloApplied: true,
      mmrDeltas: [
        { uid: p1.uid, delta: 30 },
        { uid: p2.uid, delta: 25 },
        { uid: p3.uid, delta: -30 },
        { uid: p4.uid, delta: -25 },
      ],
    } as unknown as Partial<Match> & { tournamentId: string })

    await adminCancelTournament(tId)

    const t = await fetchTournament(tId)
    expect(t?.status).toBe('cancelled')

    const remainingMatches = await fetchMatches(tId)
    expect(remainingMatches).toHaveLength(0)

    // MMR should be reverted: current - delta
    const u1 = await fetchUser(p1.uid)
    expect(u1?.mmr).toBe(1030 - 30)   // = 1000
    const u2 = await fetchUser(p2.uid)
    expect(u2?.mmr).toBe(1025 - 25)   // = 1000
    const u3 = await fetchUser(p3.uid)
    expect(u3?.mmr).toBe(970 - (-30)) // = 1000
    const u4 = await fetchUser(p4.uid)
    expect(u4?.mmr).toBe(975 - (-25)) // = 1000

    // Wins/losses reverted
    expect(u1?.stats.matchesWon).toBe(0)
    expect(u2?.stats.matchesWon).toBe(0)
    expect(u3?.stats.matchesLost).toBe(0)
    expect(u4?.stats.matchesLost).toBe(0)
  })

  it('reverte vitórias/derrotas mesmo em partidas sem mmrDeltas (retrocompatibilidade)', async () => {
    const tId = `test-cancel-nodeltas-${Date.now()}`
    const p1 = makeTestUser({ mmr: 1030, stats: { tournamentsPlayed: 0, matchesWon: 1, matchesLost: 0 } })
    const p2 = makeTestUser({ mmr: 1025, stats: { tournamentsPlayed: 0, matchesWon: 1, matchesLost: 0 } })
    const p3 = makeTestUser({ mmr: 970,  stats: { tournamentsPlayed: 0, matchesWon: 0, matchesLost: 1 } })
    const p4 = makeTestUser({ mmr: 975,  stats: { tournamentsPlayed: 0, matchesWon: 0, matchesLost: 1 } })
    await seedUsers([p1, p2, p3, p4])

    await seedTournament(tId, { participants: [p1.uid, p2.uid, p3.uid, p4.uid] })

    // Old match without mmrDeltas
    const mId = `match-nodeltas-${Date.now()}`
    await seedMatch(mId, {
      tournamentId: tId,
      teamA: { playerIds: [p1.uid, p2.uid], score: 6, mmrAverage: 1000 },
      teamB: { playerIds: [p3.uid, p4.uid], score: 2, mmrAverage: 1000 },
      status: 'finished',
      eloApplied: true,
    } as unknown as Partial<Match> & { tournamentId: string })

    await adminCancelTournament(tId)

    // MMR untouched (no deltas to revert)
    const u1 = await fetchUser(p1.uid)
    expect(u1?.mmr).toBe(p1.mmr)

    // Wins/losses ARE reverted from score comparison
    expect(u1?.stats.matchesWon).toBe(0)
    const u3 = await fetchUser(p3.uid)
    expect(u3?.stats.matchesLost).toBe(0)
  })

  it('acumula reversões de múltiplas partidas para o mesmo jogador', async () => {
    const tId = `test-cancel-multi-${Date.now()}`
    const p1 = makeTestUser({ mmr: 1060, stats: { tournamentsPlayed: 0, matchesWon: 2, matchesLost: 0 } })
    const p2 = makeTestUser({ mmr: 1050, stats: { tournamentsPlayed: 0, matchesWon: 2, matchesLost: 0 } })
    const p3 = makeTestUser({ mmr: 940,  stats: { tournamentsPlayed: 0, matchesWon: 0, matchesLost: 2 } })
    const p4 = makeTestUser({ mmr: 950,  stats: { tournamentsPlayed: 0, matchesWon: 0, matchesLost: 2 } })
    await seedUsers([p1, p2, p3, p4])

    await seedTournament(tId, { participants: [p1.uid, p2.uid, p3.uid, p4.uid] })

    // Match 1: +30/+25 for winners, -30/-25 for losers
    const m1Id = `match-multi-1-${Date.now()}`
    await seedMatch(m1Id, {
      tournamentId: tId,
      teamA: { playerIds: [p1.uid, p2.uid], score: 6, mmrAverage: 1000 },
      teamB: { playerIds: [p3.uid, p4.uid], score: 2, mmrAverage: 1000 },
      status: 'finished',
      eloApplied: true,
      mmrDeltas: [
        { uid: p1.uid, delta: 30 },
        { uid: p2.uid, delta: 25 },
        { uid: p3.uid, delta: -30 },
        { uid: p4.uid, delta: -25 },
      ],
    } as unknown as Partial<Match> & { tournamentId: string })

    // Match 2: same players again, same deltas
    const m2Id = `match-multi-2-${Date.now() + 1}`
    await seedMatch(m2Id, {
      tournamentId: tId,
      teamA: { playerIds: [p1.uid, p2.uid], score: 6, mmrAverage: 1000 },
      teamB: { playerIds: [p3.uid, p4.uid], score: 2, mmrAverage: 1000 },
      status: 'finished',
      eloApplied: true,
      mmrDeltas: [
        { uid: p1.uid, delta: 30 },
        { uid: p2.uid, delta: 25 },
        { uid: p3.uid, delta: -30 },
        { uid: p4.uid, delta: -25 },
      ],
    } as unknown as Partial<Match> & { tournamentId: string })

    await adminCancelTournament(tId)

    // MMR reverted by sum of both matches
    const u1 = await fetchUser(p1.uid)
    expect(u1?.mmr).toBe(1060 - 60)   // = 1000
    const u3 = await fetchUser(p3.uid)
    expect(u3?.mmr).toBe(940 + 60)    // = 1000

    // Wins/losses reverted (2 matches each)
    expect(u1?.stats.matchesWon).toBe(0)
    expect(u3?.stats.matchesLost).toBe(0)
  })
})
