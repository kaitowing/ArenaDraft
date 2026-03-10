const K = 32

export function calcExpected(mmrA: number, mmrB: number): number {
  return 1 / (1 + Math.pow(10, (mmrB - mmrA) / 400))
}

export function updateMMR(currentMMR: number, result: 1 | 0, expected: number): number {
  return Math.round(currentMMR + K * (result - expected))
}

interface TeamResult {
  mmrAverage: number
  playerMMRs: [number, number]
  won: boolean
}

export interface MMRDelta {
  uid: string
  oldMMR: number
  newMMR: number
  delta: number
}

export function processMatchResult(
  teamA: TeamResult & { playerUids: [string, string] },
  teamB: TeamResult & { playerUids: [string, string] },
): MMRDelta[] {
  const eA = calcExpected(teamA.mmrAverage, teamB.mmrAverage)
  const eB = 1 - eA

  const resultA = teamA.won ? 1 : (0 as 1 | 0)
  const resultB = teamB.won ? 1 : (0 as 1 | 0)

  const deltas: MMRDelta[] = []

  for (let i = 0; i < 2; i++) {
    const oldMMR = teamA.playerMMRs[i]
    const newMMR = updateMMR(oldMMR, resultA, eA)
    deltas.push({ uid: teamA.playerUids[i], oldMMR, newMMR, delta: newMMR - oldMMR })
  }

  for (let i = 0; i < 2; i++) {
    const oldMMR = teamB.playerMMRs[i]
    const newMMR = updateMMR(oldMMR, resultB, eB)
    deltas.push({ uid: teamB.playerUids[i], oldMMR, newMMR, delta: newMMR - oldMMR })
  }

  return deltas
}
