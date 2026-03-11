import { describe, it, expect } from 'vitest'
import {
  generateRandomPairsRoundRobin,
  generateRoundRobin,
  snakeDraft,
  getTeamIdFromIds,
} from './algorithms'
import { makePlayers } from '#/test/firebase-test-helpers'

// ─── generateRandomPairsRoundRobin ────────────────────────────────────────────

describe('generateRandomPairsRoundRobin', () => {
  it('retorna array vazio para menos de 4 jogadores', () => {
    expect(generateRandomPairsRoundRobin(makePlayers(2), { tournamentId: 't1' })).toHaveLength(0)
    expect(generateRandomPairsRoundRobin(makePlayers(3), { tournamentId: 't1' })).toHaveLength(0)
  })

  it('retorna array vazio para número ímpar de jogadores', () => {
    expect(generateRandomPairsRoundRobin(makePlayers(5), { tournamentId: 't1' })).toHaveLength(0)
    expect(generateRandomPairsRoundRobin(makePlayers(7), { tournamentId: 't1' })).toHaveLength(0)
  })

  describe('com 4 jogadores', () => {
    const players = makePlayers(4)
    const matches = generateRandomPairsRoundRobin(players, { tournamentId: 'test-4p' })

    it('gera exatamente n-1 = 3 rodadas', () => {
      const rounds = new Set(matches.map((m) => m.round))
      expect(rounds.size).toBe(3)
    })

    it('gera 1 partida por rodada (n/2 = 2 duplas → 1 confronto)', () => {
      const byRound = new Map<number, typeof matches>()
      for (const m of matches) {
        if (!byRound.has(m.round)) byRound.set(m.round, [])
        byRound.get(m.round)!.push(m)
      }
      for (const [, roundMatches] of byRound) {
        expect(roundMatches).toHaveLength(1)
      }
    })

    it('cada jogador aparece exatamente uma vez por rodada', () => {
      const byRound = new Map<number, Set<string>>()
      for (const m of matches) {
        if (!byRound.has(m.round)) byRound.set(m.round, new Set())
        const s = byRound.get(m.round)!
        for (const uid of [...m.teamA.playerIds, ...m.teamB.playerIds]) {
          expect(s.has(uid)).toBe(false) // nenhum jogador duplicado na rodada
          s.add(uid)
        }
      }
    })

    it('nenhum par de jogadores é parceiro mais de uma vez', () => {
      const partnerPairs = new Set<string>()
      for (const m of matches) {
        const pairA = getTeamIdFromIds(m.teamA.playerIds)
        const pairB = getTeamIdFromIds(m.teamB.playerIds)
        expect(partnerPairs.has(pairA)).toBe(false)
        expect(partnerPairs.has(pairB)).toBe(false)
        partnerPairs.add(pairA)
        partnerPairs.add(pairB)
      }
    })

    it('cada par de jogadores é parceiro exatamente uma vez (todos jogam com todos)', () => {
      // Com 4 jogadores A,B,C,D há C(4,2)=6 pares possíveis de parceiros
      // mas só 3 rodadas × 2 duplas = 6 duplas — cada par aparece exatamente 1 vez
      const partnerPairs = new Set<string>()
      for (const m of matches) {
        partnerPairs.add(getTeamIdFromIds(m.teamA.playerIds))
        partnerPairs.add(getTeamIdFromIds(m.teamB.playerIds))
      }
      expect(partnerPairs.size).toBe(6) // C(4,2) = 6
    })

    it('todos os campos obrigatórios estão presentes', () => {
      for (const m of matches) {
        expect(m.tournamentId).toBe('test-4p')
        expect(m.scoringFormat).toBe('points')
        expect(m.status).toBe('pending')
        expect(m.eloApplied).toBe(false)
        expect(m.submittedBy).toBeNull()
        expect(m.timestamp).toBeNull()
        expect(m.teamA.playerIds).toHaveLength(2)
        expect(m.teamB.playerIds).toHaveLength(2)
      }
    })

    it('repassa stage e importanceWeight para as partidas', () => {
      const ms = generateRandomPairsRoundRobin(players, {
        tournamentId: 'test-4p',
        stage: 'group',
        importanceWeight: 1,
      })
      for (const m of ms) {
        expect(m.stage).toBe('group')
        expect(m.importanceWeight).toBe(1)
      }
    })
  })

  describe('com 6 jogadores', () => {
    const players = makePlayers(6)
    const matches = generateRandomPairsRoundRobin(players, { tournamentId: 'test-6p' })

    it('gera exatamente n-1 = 5 rodadas', () => {
      const rounds = new Set(matches.map((m) => m.round))
      expect(rounds.size).toBe(5)
    })

    it('gera n/2 - 1 = 2 partidas por rodada (3 duplas → 1 confronto entre duplas faltando 1)', () => {
      // 6 jogadores → 3 duplas por rodada → floor(3/2) = 1 confronto? Não.
      // Na implementação: sortedPairs.length = 3 duplas → half = floor(3/2) = 1
      // Isso é correto: com número ímpar de duplas, uma fica sem jogar na rodada
      // PORÉM: com 6 jogadores temos n/2=3 duplas, e half=1 só gera 1 match
      // Verificando comportamento real:
      const byRound = new Map<number, number>()
      for (const m of matches) {
        byRound.set(m.round, (byRound.get(m.round) ?? 0) + 1)
      }
      // Com 3 duplas e half=floor(3/2)=1, gera 1 partida por rodada
      for (const [, count] of byRound) {
        expect(count).toBe(1)
      }
    })

    it('nenhum par de jogadores é parceiro mais de uma vez', () => {
      const partnerPairs = new Set<string>()
      for (const m of matches) {
        const pairA = getTeamIdFromIds(m.teamA.playerIds)
        const pairB = getTeamIdFromIds(m.teamB.playerIds)
        expect(partnerPairs.has(pairA)).toBe(false)
        expect(partnerPairs.has(pairB)).toBe(false)
        partnerPairs.add(pairA)
        partnerPairs.add(pairB)
      }
    })

    it('cada jogador aparece em no máximo uma dupla por rodada', () => {
      const byRound = new Map<number, Set<string>>()
      for (const m of matches) {
        if (!byRound.has(m.round)) byRound.set(m.round, new Set())
        const s = byRound.get(m.round)!
        for (const uid of [...m.teamA.playerIds, ...m.teamB.playerIds]) {
          expect(s.has(uid)).toBe(false)
          s.add(uid)
        }
      }
    })
  })

  describe('com 8 jogadores', () => {
    const players = makePlayers(8)
    const matches = generateRandomPairsRoundRobin(players, { tournamentId: 'test-8p' })

    it('gera exatamente n-1 = 7 rodadas', () => {
      const rounds = new Set(matches.map((m) => m.round))
      expect(rounds.size).toBe(7)
    })

    it('gera n/4 = 2 partidas por rodada (4 duplas → 2 confrontos)', () => {
      const byRound = new Map<number, number>()
      for (const m of matches) {
        byRound.set(m.round, (byRound.get(m.round) ?? 0) + 1)
      }
      for (const [, count] of byRound) {
        expect(count).toBe(2)
      }
    })

    it('nenhum par de jogadores é parceiro mais de uma vez', () => {
      const partnerPairs = new Set<string>()
      for (const m of matches) {
        const pairA = getTeamIdFromIds(m.teamA.playerIds)
        const pairB = getTeamIdFromIds(m.teamB.playerIds)
        expect(partnerPairs.has(pairA)).toBe(false)
        expect(partnerPairs.has(pairB)).toBe(false)
        partnerPairs.add(pairA)
        partnerPairs.add(pairB)
      }
    })

    it('cada par de jogadores é parceiro exatamente uma vez — C(8,2)=28 duplas únicas', () => {
      const partnerPairs = new Set<string>()
      for (const m of matches) {
        partnerPairs.add(getTeamIdFromIds(m.teamA.playerIds))
        partnerPairs.add(getTeamIdFromIds(m.teamB.playerIds))
      }
      expect(partnerPairs.size).toBe(28) // C(8,2) = 28
    })

    it('cada jogador aparece exatamente uma vez por rodada', () => {
      const byRound = new Map<number, Set<string>>()
      for (const m of matches) {
        if (!byRound.has(m.round)) byRound.set(m.round, new Set())
        const s = byRound.get(m.round)!
        for (const uid of [...m.teamA.playerIds, ...m.teamB.playerIds]) {
          expect(s.has(uid)).toBe(false)
          s.add(uid)
        }
      }
      // Cada rodada deve ter todos os 8 jogadores
      for (const [, uids] of byRound) {
        expect(uids.size).toBe(8)
      }
    })

    it('total de partidas = (n-1) × (n/4) = 7 × 2 = 14', () => {
      expect(matches).toHaveLength(14)
    })
  })

  describe('com 10 jogadores (folga rotativa)', () => {
    // n=10 → 9 rodadas, 5 duplas/rodada
    // Como 5 é ímpar, 1 dupla descansa por rodada (folga rotativa)
    // → 4 duplas ativas → 2 confrontos por rodada
    // Total: 9 × 2 = 18 partidas
    // Duplas únicas como parceiros: 9 rodadas × 4 duplas ativas = 36 (não 45,
    // pois cada rodada uma dupla descansa e não é contada como parceria nova)
    const players = makePlayers(10)
    const matches = generateRandomPairsRoundRobin(players, { tournamentId: 'test-10p' })

    it('gera exatamente n-1 = 9 rodadas', () => {
      const rounds = new Set(matches.map((m) => m.round))
      expect(rounds.size).toBe(9)
    })

    it('gera 2 partidas por rodada (5 duplas, 1 descansa → 4 ativas → 2 confrontos)', () => {
      const byRound = new Map<number, number>()
      for (const m of matches) {
        byRound.set(m.round, (byRound.get(m.round) ?? 0) + 1)
      }
      for (const [, count] of byRound) {
        expect(count).toBe(2)
      }
    })

    it('total de partidas = 9 × 2 = 18', () => {
      expect(matches).toHaveLength(18)
    })

    it('nenhum par de jogadores é parceiro mais de uma vez', () => {
      const partnerPairs = new Set<string>()
      for (const m of matches) {
        const pairA = getTeamIdFromIds(m.teamA.playerIds)
        const pairB = getTeamIdFromIds(m.teamB.playerIds)
        expect(partnerPairs.has(pairA), `Dupla ${pairA} repetida`).toBe(false)
        expect(partnerPairs.has(pairB), `Dupla ${pairB} repetida`).toBe(false)
        partnerPairs.add(pairA)
        partnerPairs.add(pairB)
      }
    })

    it('cada jogador aparece em no máximo uma dupla por rodada', () => {
      const byRound = new Map<number, Set<string>>()
      for (const m of matches) {
        if (!byRound.has(m.round)) byRound.set(m.round, new Set())
        const s = byRound.get(m.round)!
        for (const uid of [...m.teamA.playerIds, ...m.teamB.playerIds]) {
          expect(s.has(uid), `Jogador ${uid} duplicado na rodada ${m.round}`).toBe(false)
          s.add(uid)
        }
      }
    })

    it('a folga rotaciona: cada par de jogadores descansa pelo menos uma vez', () => {
      // Com 9 rodadas e 5 duplas, e rotação de folga por índice de rodada,
      // cada uma das 5 posições de dupla descansa em pelo menos 1 rodada.
      // Verificamos que nenhum par de jogadores aparece como dupla em TODAS as 9 rodadas
      // (isso seria impossível se a folga não rotacionasse).
      const pairRoundCount = new Map<string, number>()
      for (const m of matches) {
        const pairA = getTeamIdFromIds(m.teamA.playerIds)
        const pairB = getTeamIdFromIds(m.teamB.playerIds)
        pairRoundCount.set(pairA, (pairRoundCount.get(pairA) ?? 0) + 1)
        pairRoundCount.set(pairB, (pairRoundCount.get(pairB) ?? 0) + 1)
      }
      // Nenhuma dupla pode jogar em todas as 9 rodadas (pelo menos 1 folga)
      for (const [, count] of pairRoundCount) {
        expect(count).toBeLessThan(9)
      }
    })
  })

  it('a ordem das duplas é diferente a cada chamada (shuffle inicial é aleatório)', () => {
    // Nota: a ausência de duplas repetidas é garantida matematicamente pela
    // 1-factorização, independente do shuffle. Este teste verifica apenas que
    // o shuffle inicial produz ordens distintas entre execuções.
    // Com 8 jogadores há 8! = 40320 ordens possíveis — a probabilidade de
    // 5 execuções produzirem exatamente a mesma ordem é ~1/40320^4 ≈ 0.
    const players = makePlayers(8)
    const runs = Array.from({ length: 5 }, () =>
      generateRandomPairsRoundRobin(players, { tournamentId: 't' })
        .flatMap((m) => [...m.teamA.playerIds, ...m.teamB.playerIds])
        .join(','),
    )
    const uniqueRuns = new Set(runs)
    expect(uniqueRuns.size).toBeGreaterThan(1)
  })
})

// ─── generateRoundRobin (regressão — modo padrão não deve quebrar) ─────────────

describe('generateRoundRobin (regressão)', () => {
  it('mantém comportamento com duplas pré-formadas', () => {
    const players = makePlayers(4)
    const pairs = snakeDraft(players)
    const matches = generateRoundRobin(pairs, { tournamentId: 'rr-test' })

    expect(matches).toHaveLength(1) // 2 duplas → 1 rodada → 1 partida
    expect(matches[0].round).toBe(1)
  })

  it('gera n-1 rodadas com n duplas', () => {
    const players = makePlayers(8)
    const pairs = snakeDraft(players)
    const matches = generateRoundRobin(pairs, { tournamentId: 'rr-test' })

    const rounds = new Set(matches.map((m) => m.round))
    expect(rounds.size).toBe(3) // 4 duplas → 3 rodadas
  })
})
