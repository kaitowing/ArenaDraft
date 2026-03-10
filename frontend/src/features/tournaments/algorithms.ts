import type { AppUser, BracketRound, Match, MatchStage, Team } from '#/types'

export type Pair = [AppUser, AppUser]

function pairMmrAverage(pair: Pair) {
  return Math.round((pair[0].mmr + pair[1].mmr) / 2)
}

export function getTeamIdFromIds(ids: [string, string]) {
  return [...ids].sort().join('-')
}

export function getTeamIdFromPair(pair: Pair) {
  return getTeamIdFromIds([pair[0].uid, pair[1].uid])
}

export function pairToTeam(pair: Pair, teamId = getTeamIdFromPair(pair)): Team {
  return {
    playerIds: [pair[0].uid, pair[1].uid],
    score: null,
    mmrAverage: pairMmrAverage(pair),
    genderPattern: [pair[0].gender ?? null, pair[1].gender ?? null],
    teamId,
  }
}

/**
 * Snake Draft: sort players by MMR desc, pair highest with lowest.
 * [1,8], [2,7], [3,6], [4,5] for 8 players.
 */
export function snakeDraft(players: AppUser[]): Pair[] {
  const sorted = [...players].sort((a, b) => b.mmr - a.mmr)
  const pairs: Pair[] = []
  const n = Math.floor(sorted.length / 2)
  for (let i = 0; i < n; i++) {
    pairs.push([sorted[i], sorted[sorted.length - 1 - i]])
  }
  return pairs
}

interface RoundRobinOptions {
  tournamentId: string
  isRoundTrip?: boolean
  stage?: MatchStage
  groupId?: string | null
  startingRound?: number
  importanceWeight?: number
}

export function generateRoundRobin(
  pairs: Pair[],
  options: RoundRobinOptions,
): Omit<Match, 'id'>[] {
  const { tournamentId, isRoundTrip = false, stage, groupId = null, startingRound = 1, importanceWeight } = options
  const n = pairs.length
  const matches: Omit<Match, 'id'>[] = []

  if (n < 2) return matches

  // All unique pair combinations (each pair vs every other pair)
  // Total rounds = n - 1 (round robin)
  const indices = Array.from({ length: n }, (_, i) => i)
  const fixed = indices[0]
  const rotating = indices.slice(1)

  const totalRounds = n - 1

  // Generate matches for each round (and return round if round-trip)
  const generateRoundMatches = (round: number, reverseTeams = false): Omit<Match, 'id'>[] => {
    const roundIndices = [fixed, ...rotating]
    const matchesThisRound: Omit<Match, 'id'>[] = []

    for (let i = 0; i < Math.floor(n / 2); i++) {
      const teamAIndex = roundIndices[i]
      const teamBIndex = roundIndices[n - 1 - i]
      const teamAPair = pairs[teamAIndex]
      const teamBPair = pairs[teamBIndex]

      // For return round, swap teams
      const [finalTeamA, finalTeamB] = reverseTeams
        ? [teamBPair, teamAPair]
        : [teamAPair, teamBPair]

      const teamA = pairToTeam(finalTeamA)
      const teamB = pairToTeam(finalTeamB)

      matchesThisRound.push({
        tournamentId,
        round: startingRound + round,
        scoringFormat: 'points',
        teamA,
        teamB,
        status: 'pending',
        submittedBy: null,
        eloApplied: false,
        timestamp: null,
        stage,
        groupId,
        importanceWeight,
      })
    }

    return matchesThisRound
  }

  for (let round = 0; round < totalRounds; round++) {
    // First leg (ida)
    matches.push(...generateRoundMatches(round, false))

    // Second leg (volta) if round-trip
    if (isRoundTrip) {
      matches.push(...generateRoundMatches(round + totalRounds, true))
    }

    // Rotate: last element of rotating goes to front
    rotating.unshift(rotating.pop()!)
  }

  return matches
}

export function distributePairsIntoGroups(pairs: Pair[], groupCount: number): Pair[][] {
  if (groupCount <= 0) return []
  const sorted = [...pairs].sort((a, b) => pairMmrAverage(b) - pairMmrAverage(a))
  const groups = Array.from({ length: groupCount }, () => [] as Pair[])
  let index = 0
  let direction = 1
  for (const pair of sorted) {
    groups[index].push(pair)
    if (groupCount === 1) continue
    if (direction === 1) {
      if (index === groupCount - 1) {
        direction = -1
        index--
      } else {
        index++
      }
    } else {
      if (index === 0) {
        direction = 1
        index++
      } else {
        index--
      }
    }
  }
  return groups
}

export function groupIdFromIndex(idx: number) {
  return String.fromCharCode('A'.charCodeAt(0) + idx)
}

export interface GroupAllocation {
  id: string
  name: string
  teams: Team[]
}

export function buildGroupStage(
  pairs: Pair[],
  options: { tournamentId: string; groupCount: number; isRoundTrip?: boolean },
) {
  const { tournamentId, groupCount, isRoundTrip } = options
  const groups: GroupAllocation[] = []
  const distributed = distributePairsIntoGroups(pairs, groupCount)
  const matches: Omit<Match, 'id'>[] = []

  distributed.forEach((groupPairs, idx) => {
    const id = groupIdFromIndex(idx)
    const name = `Grupo ${id}`
    const teams = groupPairs.map((pair) => {
      const team = pairToTeam(pair)
      return {
        ...team,
        score: null,
        wins: 0,
        losses: 0,
        points: 0,
      }
    })
    groups.push({ id, name, teams })

    const groupMatches = generateRoundRobin(groupPairs, {
      tournamentId,
      isRoundTrip,
      stage: 'group',
      groupId: id,
      importanceWeight: 1,
    })
    matches.push(...groupMatches)
  })

  return { groups, matches }
}

export interface SeededTeam extends Team {
  seed: number
}

export function generateBracketMatchesFromSeeds(
  seeds: SeededTeam[],
  tournamentId: string,
): Omit<Match, 'id'>[] {
  if (seeds.length === 0 || (seeds.length & (seeds.length - 1)) !== 0) return []
  const matches: Omit<Match, 'id'>[] = []
  const totalTeams = seeds.length
  const roundLabel = (size: number): BracketRound => {
    if (size <= 2) return 'F'
    if (size <= 4) return 'SF'
    if (size <= 8) return 'QF'
    return 'R16'
  }

  for (let i = 0; i < totalTeams / 2; i++) {
    const teamA = seeds[i]
    const teamB = seeds[totalTeams - 1 - i]
    matches.push({
      tournamentId,
      round: 1,
      scoringFormat: 'sets',
      teamA,
      teamB,
      status: 'pending',
      submittedBy: null,
      eloApplied: false,
      timestamp: null,
      stage: 'playoff',
      bracketRound: roundLabel(totalTeams),
      seedA: teamA.seed,
      seedB: teamB.seed,
      importanceWeight: 1.25,
    })
  }

  return matches
}
