import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { db } from '#/lib/firebase'
import type { AppUser, Match } from '#/types'
import { processMatchResult } from './eloService'
import { completeTournament } from '../tournaments/tournamentService'

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

    const [p1Snap, p2Snap, p3Snap, p4Snap, tournamentSnap] = await Promise.all([
      tx.get(doc(db, 'users', match.teamA.playerIds[0])),
      tx.get(doc(db, 'users', match.teamA.playerIds[1])),
      tx.get(doc(db, 'users', match.teamB.playerIds[0])),
      tx.get(doc(db, 'users', match.teamB.playerIds[1])),
      tx.get(doc(db, 'tournaments', match.tournamentId)),
    ])

    const players = [p1Snap, p2Snap, p3Snap, p4Snap].map((s) => s.data() as AppUser)
    const [p1, p2, p3, p4] = players

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
    )

    const winnerUids = teamAWon ? [p1.uid, p2.uid] : [p3.uid, p4.uid]

    const matchUpdate: Record<string, unknown> = {
      'teamA.score': scoreA,
      'teamB.score': scoreB,
      scoringFormat: payload.scoringFormat,
      status: 'finished',
      submittedBy,
      eloApplied: true,
      timestamp: serverTimestamp(),
    }
    if (setsA) matchUpdate['teamA.sets'] = setsA
    if (setsB) matchUpdate['teamB.sets'] = setsB

    tx.update(matchRef, matchUpdate)

    for (const delta of deltas) {
      const player = players.find((p) => p.uid === delta.uid)!
      const isWinner = winnerUids.includes(delta.uid)
      tx.update(doc(db, 'users', delta.uid), {
        mmr: delta.newMMR,
        'stats.matchesWon': isWinner ? player.stats.matchesWon + 1 : player.stats.matchesWon,
        'stats.matchesLost': !isWinner ? player.stats.matchesLost + 1 : player.stats.matchesLost,
      })
    }

    if (tournamentSnap.exists()) {
      const tournament = { id: tournamentSnap.id, ...tournamentSnap.data() } as import('#/types').Tournament
      if (tournament.status === 'in_progress') {
        tournamentIdToCheck = match.tournamentId
      }
    }
  })

  if (tournamentIdToCheck) {
    const tRef = doc(db, 'tournaments', tournamentIdToCheck)
    const tSnap = await getDoc(tRef)
    if (!tSnap.exists()) return
    const t = { id: tSnap.id, ...tSnap.data() } as import('#/types').Tournament
    if (t.status !== 'in_progress') return

    const q = query(collection(db, 'matches'), where('tournamentId', '==', tournamentIdToCheck))
    const snap = await getDocs(q)
    const matches = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Match)
    const allFinished = matches.length > 0 && matches.every((m) => m.status === 'finished')
    if (allFinished) {
      await completeTournament(tournamentIdToCheck)
    }
  }
}
