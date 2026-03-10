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

/**
 * Polygon (Round Robin) algorithm.
 * Fixes pair[0], rotates the rest to generate all rounds.
 * Each round contains matchups between pairs that haven't played each other yet.
 */
export function generateRoundRobin(
  pairs: Pair[],
  tournamentId: string,
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

  for (let round = 0; round < totalRounds; round++) {
    // Build this round's pairings from the polygon rotation
    const roundIndices = [fixed, ...rotating]
    const matchesThisRound: Omit<Match, 'id'>[] = []

    for (let i = 0; i < Math.floor(n / 2); i++) {
      const teamAIndex = roundIndices[i]
      const teamBIndex = roundIndices[n - 1 - i]
      const teamAPair = pairs[teamAIndex]
      const teamBPair = pairs[teamBIndex]

      const teamA: Team = {
        playerIds: [teamAPair[0].uid, teamAPair[1].uid],
        score: null,
        mmrAverage: Math.round((teamAPair[0].mmr + teamAPair[1].mmr) / 2),
      }
      const teamB: Team = {
        playerIds: [teamBPair[0].uid, teamBPair[1].uid],
        score: null,
        mmrAverage: Math.round((teamBPair[0].mmr + teamBPair[1].mmr) / 2),
      }

      matchesThisRound.push({
        tournamentId,
        round: round + 1,
        teamA,
        teamB,
        status: 'pending',
        submittedBy: null,
        eloApplied: false,
        timestamp: null,
      })
    }

    matches.push(...matchesThisRound)

    // Rotate: last element of rotating goes to front
    rotating.unshift(rotating.pop()!)
  }

  return matches
}
