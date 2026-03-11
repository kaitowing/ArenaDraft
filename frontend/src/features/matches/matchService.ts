import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, where, writeBatch } from 'firebase/firestore'
import { db } from '#/lib/firebase'
import type { AppUser, Match, Tournament } from '#/types'
import { processMatchResult } from './eloService'
import { completeTournament } from '../tournaments/tournamentService'
import { generateBracketMatchesFromSeeds, type SeededTeam } from '#/features/tournaments/algorithms'

export interface ScorePayload {
  scoringFormat: 'points' | 'sets'
  /** used when scoringFormat === 'points' */
  pointsA?: number
  pointsB?: number
  /** used when scoringFormat === 'sets'; each element is points scored in that set */
  setsA?: number[]
  setsB?: number[]
}

function deriveResult(payload: ScorePayload): {
  teamAWon: boolean
  scoreA: number
  scoreB: number
  setsA: number[] | undefined
  setsB: number[] | undefined
  marginPoints: number
} {
  if (payload.scoringFormat === 'sets') {
    const sA = payload.setsA ?? []
    const sB = payload.setsB ?? []
    if (sA.length === 0 || sA.length !== sB.length) {
      throw new Error('Número de sets inválido.')
    }
    let winsA = 0
    let winsB = 0
    let totalA = 0
    let totalB = 0
    for (let i = 0; i < sA.length; i++) {
      totalA += sA[i]
      totalB += sB[i]
      if (sA[i] > sB[i]) winsA++
      else if (sB[i] > sA[i]) winsB++
    }
    if (winsA === winsB) throw new Error('Empate de sets não é permitido.')
    return {
      teamAWon: winsA > winsB,
      scoreA: winsA,
      scoreB: winsB,
      setsA: sA,
      setsB: sB,
      marginPoints: Math.abs(totalA - totalB),
    }
  } else {
    const pA = payload.pointsA ?? 0
    const pB = payload.pointsB ?? 0
    if (pA === pB) throw new Error('Empate não é permitido.')
    return {
      teamAWon: pA > pB,
      scoreA: pA,
      scoreB: pB,
      setsA: undefined,
      setsB: undefined,
      marginPoints: Math.abs(pA - pB),
    }
  }
}

function sortGroupTeams(a: { wins: number; losses: number; points: number; mmrAverage: number }, b: { wins: number; losses: number; points: number; mmrAverage: number }) {
  return b.wins - a.wins || a.losses - b.losses || b.points - a.points || b.mmrAverage - a.mmrAverage
}

async function generateClassicBracket(tournament: Tournament) {
  if (!tournament.groups || tournament.bracketGenerated) return
  const advance = tournament.advancePerGroup ?? 2
  const seeds: SeededTeam[] = []
  for (let rank = 0; rank < advance; rank++) {
    for (const group of tournament.groups) {
      const sorted = [...group.teams].sort(sortGroupTeams)
      const team = sorted[rank]
      if (!team) continue
      seeds.push({
        seed: seeds.length + 1,
        playerIds: team.playerIds,
        score: null,
        mmrAverage: team.mmrAverage,
        genderPattern: team.genderPattern,
        teamId: team.teamId,
      })
    }
  }
  if (seeds.length === 0 || (seeds.length & (seeds.length - 1)) !== 0) return
  const matches = generateBracketMatchesFromSeeds(seeds, tournament.id)
  if (matches.length === 0) return
  const batch = writeBatch(db)
  for (const match of matches) {
    const ref = doc(collection(db, 'matches'))
    batch.set(ref, match)
  }
  batch.update(doc(db, 'tournaments', tournament.id), { bracketGenerated: true })
  await batch.commit()
}

export async function updateMatchScore(
  matchId: string,
  payload: ScorePayload,
  submittedBy: string,
) {
  let tournamentIdToCheck: string | null = null

  await runTransaction(db, async (tx) => {
    const matchRef = doc(db, 'matches', matchId)
    const matchSnap = await tx.get(matchRef)
    if (!matchSnap.exists()) throw new Error('Partida não encontrada')

    const match = { id: matchSnap.id, ...matchSnap.data() } as Match
    if (match.status === 'finished' || match.eloApplied) {
      throw new Error('Placar já foi registrado.')
    }

    const { teamAWon, scoreA, scoreB, setsA, setsB, marginPoints } = deriveResult(payload)

    const tournamentRef = doc(db, 'tournaments', match.tournamentId)
    const [p1Snap, p2Snap, p3Snap, p4Snap, tournamentSnap] = await Promise.all([
      tx.get(doc(db, 'users', match.teamA.playerIds[0])),
      tx.get(doc(db, 'users', match.teamA.playerIds[1])),
      tx.get(doc(db, 'users', match.teamB.playerIds[0])),
      tx.get(doc(db, 'users', match.teamB.playerIds[1])),
      tx.get(tournamentRef),
    ])

    const players = [p1Snap, p2Snap, p3Snap, p4Snap].map((s) => s.data() as AppUser)
    const [p1, p2, p3, p4] = players

    const importanceWeight = match.stage === 'playoff'
      ? match.bracketRound === 'F'
        ? 1.5
        : 1.25
      : 1

    const deltas = processMatchResult(
      {
        mmrAverage: match.teamA.mmrAverage,
        playerMMRs: [p1.mmr, p2.mmr],
        playerUids: [p1.uid, p2.uid],
        won: teamAWon,
      },
      {
        mmrAverage: match.teamB.mmrAverage,
        playerMMRs: [p3.mmr, p4.mmr],
        playerUids: [p3.uid, p4.uid],
        won: !teamAWon,
      },
      marginPoints,
      importanceWeight,
    )

    const winnerUids = teamAWon ? [p1.uid, p2.uid] : [p3.uid, p4.uid]

    const isFinalMatch = match.stage === 'playoff' && match.bracketRound === 'F'

    const mmrDeltas: Array<{ uid: string; delta: number }> = deltas.map((d) => {
      const isWinner = winnerUids.includes(d.uid)
      const bonus = isFinalMatch ? (isWinner ? 24 : 12) : 0
      return { uid: d.uid, delta: d.delta + bonus }
    })

    const matchUpdate: Record<string, unknown> = {
      'teamA.score': scoreA,
      'teamB.score': scoreB,
      scoringFormat: payload.scoringFormat,
      status: 'finished',
      submittedBy,
      eloApplied: true,
      timestamp: serverTimestamp(),
      mmrDeltas,
    }
    if (setsA) matchUpdate['teamA.sets'] = setsA
    if (setsB) matchUpdate['teamB.sets'] = setsB

    tx.update(matchRef, matchUpdate)

    for (const delta of deltas) {
      const player = players.find((p) => p.uid === delta.uid)!
      const isWinner = winnerUids.includes(delta.uid)
      const bonus = isFinalMatch ? (isWinner ? 24 : 12) : 0
      tx.update(doc(db, 'users', delta.uid), {
        mmr: delta.newMMR + bonus,
        'stats.matchesWon': isWinner ? player.stats.matchesWon + 1 : player.stats.matchesWon,
        'stats.matchesLost': !isWinner ? player.stats.matchesLost + 1 : player.stats.matchesLost,
      })
    }

    if (tournamentSnap.exists()) {
      const tournament = { id: tournamentSnap.id, ...tournamentSnap.data() } as Tournament
      if (match.stage === 'group' && tournament.groups) {
        const updatedGroups = tournament.groups.map((group) => {
          if (group.id !== match.groupId) return group
          return {
            ...group,
            teams: group.teams.map((team) => {
              if (team.teamId === match.teamA.teamId) {
                return {
                  ...team,
                  wins: team.wins + (teamAWon ? 1 : 0),
                  losses: team.losses + (teamAWon ? 0 : 1),
                  points: team.points + (teamAWon ? 2 : 0),
                }
              }
              if (team.teamId === match.teamB.teamId) {
                return {
                  ...team,
                  wins: team.wins + (teamAWon ? 0 : 1),
                  losses: team.losses + (teamAWon ? 1 : 0),
                  points: team.points + (teamAWon ? 0 : 2),
                }
              }
              return team
            }),
          }
        })
        tx.update(tournamentRef, { groups: updatedGroups })
      }
      if (tournament.status === 'in_progress') {
        tournamentIdToCheck = match.tournamentId
      }
    }
  })

  if (tournamentIdToCheck) {
    const tRef = doc(db, 'tournaments', tournamentIdToCheck)
    const tSnap = await getDoc(tRef)
    if (!tSnap.exists()) return
    const t = { id: tSnap.id, ...tSnap.data() } as Tournament
    if (t.status !== 'in_progress') return

    const q = query(collection(db, 'matches'), where('tournamentId', '==', tournamentIdToCheck))
    const snap = await getDocs(q)
    const matches = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Match)
    if (t.format === 'classic') {
      const groupMatches = matches.filter((m) => m.stage === 'group')
      const allGroupsFinished = groupMatches.length > 0 && groupMatches.every((m) => m.status === 'finished')
      if (allGroupsFinished && !t.bracketGenerated) {
        await generateClassicBracket(t)
        return
      }
    }
    const allFinished = matches.length > 0 && matches.every((m) => m.status === 'finished')
    if (allFinished) {
      await completeTournament(tournamentIdToCheck)
    }
  }
}
