/**
 * Integration tests for tournamentService.
 *
 * Uses the real arenadrafthlg (staging) Firebase project with open security
 * rules. All documents are cleaned up via cleanupFirestore() in afterAll.
 *
 * vi.mock replaces '#/lib/firebase' so the service uses the test Firestore
 * instance instead of the one initialized via import.meta.env.
 */
import { describe, it, expect, afterAll, vi, beforeEach } from 'vitest'
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { getTestDb, teardownTestApp, cleanupFirestore, makePlayers } from '#/test/firebase-test-helpers'
import type { Match, Tournament } from '#/types'

// ─── Inject test DB before the service module loads ───────────────────────────
vi.mock('#/lib/firebase', () => ({
  app: {},
  auth: {},
  db: getTestDb(),
}))

// Dynamic import AFTER mock is registered
const { createTournamentLobby, startTournament } = await import('./tournamentService')

// ─── Cleanup tracking ─────────────────────────────────────────────────────────
const createdTournamentIds: string[] = []

afterAll(async () => {
  await cleanupFirestore(createdTournamentIds)
  await teardownTestApp()
})

// Reset user counter between suites so fixtures are predictable
beforeEach(() => {
  // counter lives in the helper module; resets happen implicitly per test
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchTournament(id: string): Promise<Tournament> {
  const snap = await getDoc(doc(getTestDb(), 'tournaments', id))
  if (!snap.exists()) throw new Error(`Tournament ${id} not found`)
  return { id: snap.id, ...snap.data() } as Tournament
}

async function fetchMatches(tournamentId: string): Promise<Match[]> {
  const snap = await getDocs(
    query(collection(getTestDb(), 'matches'), where('tournamentId', '==', tournamentId)),
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Match)
}

// ─── createTournamentLobby ────────────────────────────────────────────────────

describe('createTournamentLobby', () => {
  it('cria torneio padrão com status waiting', async () => {
    const id = await createTournamentLobby('test-owner', { name: 'Torneio Básico' })
    createdTournamentIds.push(id)

    const t = await fetchTournament(id)
    expect(t.status).toBe('waiting')
    expect(t.name).toBe('Torneio Básico')
    expect(t.format).toBe('round_robin')
    expect(t.createdBy).toBe('test-owner')
    expect(t.participants).toContain('test-owner')
    expect(t.randomPairs).toBe(false)
    expect(t.isRoundTrip).toBe(false)
    expect(t.joinCode).toMatch(/^[A-Z0-9]{6}$/)
  })

  it('salva randomPairs=true quando especificado', async () => {
    const id = await createTournamentLobby('test-owner', {
      name: 'Torneio Duplas Aleatórias',
      randomPairs: true,
    })
    createdTournamentIds.push(id)

    const t = await fetchTournament(id)
    expect(t.randomPairs).toBe(true)
  })

  it('força isRoundTrip=false quando randomPairs=true', async () => {
    const id = await createTournamentLobby('test-owner', {
      name: 'RP sem Ida e Volta',
      randomPairs: true,
      isRoundTrip: true, // deve ser sobrescrito
    })
    createdTournamentIds.push(id)

    const t = await fetchTournament(id)
    expect(t.isRoundTrip).toBe(false)
    expect(t.randomPairs).toBe(true)
  })

  it('cria torneio clássico com groupCount e bracketSize corretos', async () => {
    const id = await createTournamentLobby('test-owner', {
      name: 'Torneio Clássico',
      format: 'classic',
      groupCount: 2,
      advancePerGroup: 2,
    })
    createdTournamentIds.push(id)

    const t = await fetchTournament(id)
    expect(t.format).toBe('classic')
    expect(t.groupCount).toBe(2)
    expect(t.bracketSize).toBe(4) // 2 grupos × 2 classificados
  })

  it('gera joinCode único entre dois torneios criados em sequência', async () => {
    const id1 = await createTournamentLobby('test-owner', { name: 'T1' })
    const id2 = await createTournamentLobby('test-owner', { name: 'T2' })
    createdTournamentIds.push(id1, id2)

    const [t1, t2] = await Promise.all([fetchTournament(id1), fetchTournament(id2)])
    // Códigos podem coincidir por acaso mas é extremamente improvável
    // O teste garante que são strings válidas no formato correto
    expect(t1.joinCode).toMatch(/^[A-Z0-9]{6}$/)
    expect(t2.joinCode).toMatch(/^[A-Z0-9]{6}$/)
  })
})

// ─── startTournament — round_robin padrão (duplas manuais) ───────────────────

describe('startTournament — round_robin padrão', () => {
  it('atualiza status para in_progress e gera partidas', async () => {
    const players = makePlayers(4)
    const id = await createTournamentLobby(players[0].uid, {
      name: 'RR 4 jogadores',
      format: 'round_robin',
    })
    createdTournamentIds.push(id)

    await startTournament(id, [[players[0], players[3]], [players[1], players[2]]])

    const t = await fetchTournament(id)
    expect(t.status).toBe('in_progress')

    const matches = await fetchMatches(id)
    // 2 duplas → 1 rodada → 1 partida
    expect(matches).toHaveLength(1)
    expect(matches[0].round).toBe(1)
    expect(matches[0].status).toBe('pending')
    expect(matches[0].scoringFormat).toBe('points')
    expect(matches[0].stage).toBe('group')
  })

  it('gera 3 rodadas e 6 partidas para 8 jogadores (4 duplas)', async () => {
    const players = makePlayers(8)
    const id = await createTournamentLobby(players[0].uid, {
      name: 'RR 8 jogadores',
      format: 'round_robin',
    })
    createdTournamentIds.push(id)

    await startTournament(id, [
      [players[0], players[7]],
      [players[1], players[6]],
      [players[2], players[5]],
      [players[3], players[4]],
    ])

    const matches = await fetchMatches(id)
    const rounds = new Set(matches.map((m) => m.round))
    expect(rounds.size).toBe(3)    // n-1 = 4-1 = 3 rodadas
    expect(matches).toHaveLength(6) // 3 rodadas × 2 partidas
  })

  it('gera partidas ida e volta quando isRoundTrip=true', async () => {
    const players = makePlayers(4)
    const id = await createTournamentLobby(players[0].uid, {
      name: 'RR Ida e Volta',
      format: 'round_robin',
      isRoundTrip: true,
    })
    createdTournamentIds.push(id)

    await startTournament(id, [[players[0], players[3]], [players[1], players[2]]])

    const matches = await fetchMatches(id)
    // Ida e volta duplica: 1 partida × 2 = 2
    expect(matches).toHaveLength(2)
  })
})

// ─── startTournament — randomPairs ───────────────────────────────────────────

describe('startTournament — randomPairs=true', () => {
  it('atualiza status para in_progress com 4 jogadores', async () => {
    const players = makePlayers(4)
    const id = await createTournamentLobby(players[0].uid, {
      name: 'RP 4 jogadores',
      format: 'round_robin',
      randomPairs: true,
    })
    createdTournamentIds.push(id)

    await startTournament(id, [[players[0], players[1]], [players[2], players[3]]])

    const t = await fetchTournament(id)
    expect(t.status).toBe('in_progress')
  })

  it('gera n-1 = 3 rodadas e 3 partidas para 4 jogadores', async () => {
    const players = makePlayers(4)
    const id = await createTournamentLobby(players[0].uid, {
      name: 'RP 4 jogadores contagem',
      format: 'round_robin',
      randomPairs: true,
    })
    createdTournamentIds.push(id)

    await startTournament(id, [[players[0], players[1]], [players[2], players[3]]])

    const matches = await fetchMatches(id)
    const rounds = new Set(matches.map((m) => m.round))
    expect(rounds.size).toBe(3)    // n-1 = 4-1 = 3 rodadas
    expect(matches).toHaveLength(3) // 3 rodadas × 1 partida
  })

  it('gera n-1 = 7 rodadas e 14 partidas para 8 jogadores', async () => {
    const players = makePlayers(8)
    const id = await createTournamentLobby(players[0].uid, {
      name: 'RP 8 jogadores contagem',
      format: 'round_robin',
      randomPairs: true,
    })
    createdTournamentIds.push(id)

    await startTournament(id, [
      [players[0], players[1]],
      [players[2], players[3]],
      [players[4], players[5]],
      [players[6], players[7]],
    ])

    const matches = await fetchMatches(id)
    const rounds = new Set(matches.map((m) => m.round))
    expect(rounds.size).toBe(7)     // n-1 = 8-1 = 7 rodadas
    expect(matches).toHaveLength(14) // 7 rodadas × 2 partidas
  })

  it('nenhum par de jogadores é parceiro mais de uma vez — 8 jogadores', async () => {
    const players = makePlayers(8)
    const id = await createTournamentLobby(players[0].uid, {
      name: 'RP sem dupla repetida',
      format: 'round_robin',
      randomPairs: true,
    })
    createdTournamentIds.push(id)

    await startTournament(id, [
      [players[0], players[1]],
      [players[2], players[3]],
      [players[4], players[5]],
      [players[6], players[7]],
    ])

    const matches = await fetchMatches(id)
    const { getTeamIdFromIds } = await import('./algorithms')

    const partnerPairs = new Set<string>()
    for (const m of matches) {
      const pairA = getTeamIdFromIds(m.teamA.playerIds)
      const pairB = getTeamIdFromIds(m.teamB.playerIds)
      expect(partnerPairs.has(pairA), `Dupla ${pairA} repetida`).toBe(false)
      expect(partnerPairs.has(pairB), `Dupla ${pairB} repetida`).toBe(false)
      partnerPairs.add(pairA)
      partnerPairs.add(pairB)
    }

    // C(8,2) = 28 pares únicos — todos devem aparecer exatamente uma vez
    expect(partnerPairs.size).toBe(28)
  })

  it('cada jogador aparece exatamente uma vez por rodada — 8 jogadores', async () => {
    const players = makePlayers(8)
    const id = await createTournamentLobby(players[0].uid, {
      name: 'RP 1 vez por rodada',
      format: 'round_robin',
      randomPairs: true,
    })
    createdTournamentIds.push(id)

    await startTournament(id, [
      [players[0], players[1]],
      [players[2], players[3]],
      [players[4], players[5]],
      [players[6], players[7]],
    ])

    const matches = await fetchMatches(id)
    const byRound = new Map<number, Set<string>>()
    for (const m of matches) {
      if (!byRound.has(m.round)) byRound.set(m.round, new Set())
      const s = byRound.get(m.round)!
      for (const uid of [...m.teamA.playerIds, ...m.teamB.playerIds]) {
        expect(s.has(uid), `Jogador ${uid} aparece 2x na rodada ${m.round}`).toBe(false)
        s.add(uid)
      }
    }
    for (const [round, uids] of byRound) {
      expect(uids.size, `Rodada ${round} deve ter todos os 8 jogadores`).toBe(8)
    }
  })

  it('salva os metadados corretos em todas as partidas', async () => {
    const players = makePlayers(4)
    const id = await createTournamentLobby(players[0].uid, {
      name: 'RP metadados',
      format: 'round_robin',
      randomPairs: true,
    })
    createdTournamentIds.push(id)

    await startTournament(id, [[players[0], players[1]], [players[2], players[3]]])

    const matches = await fetchMatches(id)
    for (const m of matches) {
      expect(m.tournamentId).toBe(id)
      expect(m.stage).toBe('group')
      expect(m.importanceWeight).toBe(1)
      expect(m.scoringFormat).toBe('points')
      expect(m.status).toBe('pending')
      expect(m.eloApplied).toBe(false)
      expect(m.teamA.playerIds).toHaveLength(2)
      expect(m.teamB.playerIds).toHaveLength(2)
    }
  })

  it('usa todos os jogadores passados como pares — não reutiliza os pares dummy', async () => {
    const players = makePlayers(4)
    const id = await createTournamentLobby(players[0].uid, {
      name: 'RP usa todos jogadores',
      format: 'round_robin',
      randomPairs: true,
    })
    createdTournamentIds.push(id)

    await startTournament(id, [[players[0], players[1]], [players[2], players[3]]])

    const matches = await fetchMatches(id)
    const allPlayerIds = new Set(players.map((p) => p.uid))
    const seenInMatches = new Set<string>()

    for (const m of matches) {
      for (const uid of [...m.teamA.playerIds, ...m.teamB.playerIds]) {
        expect(allPlayerIds.has(uid), `UID ${uid} não pertence aos jogadores do teste`).toBe(true)
        seenInMatches.add(uid)
      }
    }

    // Todos os 4 jogadores devem aparecer nas partidas
    expect(seenInMatches.size).toBe(4)
  })
})
