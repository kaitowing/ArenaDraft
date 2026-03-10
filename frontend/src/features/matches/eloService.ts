const K = 32
const MARGIN_DIVISOR = 15

export function calcExpected(mmrA: number, mmrB: number): number {
  return 1 / (1 + Math.pow(10, (mmrB - mmrA) / 400))
}

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value))
}

export function calcMarginFactor(marginPoints: number): number {
  return clamp(0.75, 1.75, 1 + marginPoints / MARGIN_DIVISOR)
}

export function updateMMR(
  currentMMR: number,
  result: 1 | 0,
  expected: number,
  marginFactor = 1,
): number {
  return Math.round(currentMMR + K * marginFactor * (result - expected))
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
  marginPoints = 0,
): MMRDelta[] {
  const eA = calcExpected(teamA.mmrAverage, teamB.mmrAverage)
  const eB = 1 - eA

  const resultA = teamA.won ? 1 : (0 as 1 | 0)
  const resultB = teamB.won ? 1 : (0 as 1 | 0)
  const marginFactor = calcMarginFactor(Math.abs(marginPoints))

  const deltas: MMRDelta[] = []

  for (let i = 0; i < 2; i++) {
    const oldMMR = teamA.playerMMRs[i]
    const newMMR = updateMMR(oldMMR, resultA, eA, marginFactor)
    deltas.push({ uid: teamA.playerUids[i], oldMMR, newMMR, delta: newMMR - oldMMR })
  }

  for (let i = 0; i < 2; i++) {
    const oldMMR = teamB.playerMMRs[i]
    const newMMR = updateMMR(oldMMR, resultB, eB, marginFactor)
    deltas.push({ uid: teamB.playerUids[i], oldMMR, newMMR, delta: newMMR - oldMMR })
  }

  return deltas
}
