import type { AppUser, Match, Team } from '#/types'

export type Pair = [AppUser, AppUser]

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

export function generateRoundRobin(
  pairs: Pair[],
  tournamentId: string,
  isRoundTrip = false,
): Omit<Match, 'id'>[] {
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

      const teamA: Team = {
        playerIds: [finalTeamA[0].uid, finalTeamA[1].uid],
        score: null,
        mmrAverage: Math.round((finalTeamA[0].mmr + finalTeamA[1].mmr) / 2),
      }
      const teamB: Team = {
        playerIds: [finalTeamB[0].uid, finalTeamB[1].uid],
        score: null,
        mmrAverage: Math.round((finalTeamB[0].mmr + finalTeamB[1].mmr) / 2),
      }

      matchesThisRound.push({
        tournamentId,
        round: round + 1,
        scoringFormat: 'points',
        teamA,
        teamB,
        status: 'pending',
        submittedBy: null,
        eloApplied: false,
        timestamp: null,
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
