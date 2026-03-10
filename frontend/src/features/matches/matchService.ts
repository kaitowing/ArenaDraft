import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '#/lib/firebase'
import type { AppUser, Match } from '#/types'
import { processMatchResult } from './eloService'

export async function updateMatchScore(
  matchId: string,
  scoreA: number,
  scoreB: number,
  submittedBy: string,
) {
  await runTransaction(db, async (tx) => {
    const matchRef = doc(db, 'matches', matchId)
    const matchSnap = await tx.get(matchRef)
    if (!matchSnap.exists()) throw new Error('Partida não encontrada')

    const match = { id: matchSnap.id, ...matchSnap.data() } as Match
    if (match.status === 'finished' || match.eloApplied) {
      throw new Error('Placar já foi registrado.')
    }

    const [p1Snap, p2Snap, p3Snap, p4Snap] = await Promise.all([
      tx.get(doc(db, 'users', match.teamA.playerIds[0])),
      tx.get(doc(db, 'users', match.teamA.playerIds[1])),
      tx.get(doc(db, 'users', match.teamB.playerIds[0])),
      tx.get(doc(db, 'users', match.teamB.playerIds[1])),
    ])

    const players = [p1Snap, p2Snap, p3Snap, p4Snap].map(
      (s) => s.data() as AppUser,
    )
    const [p1, p2, p3, p4] = players
    const teamAWon = scoreA > scoreB

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
    )

    const winnerUids = teamAWon
      ? [p1.uid, p2.uid]
      : [p3.uid, p4.uid]

    tx.update(matchRef, {
      'teamA.score': scoreA,
      'teamB.score': scoreB,
      status: 'finished',
      submittedBy,
      eloApplied: true,
      timestamp: serverTimestamp(),
    })

    for (const delta of deltas) {
      const player = players.find((p) => p.uid === delta.uid)!
      const isWinner = winnerUids.includes(delta.uid)
      tx.update(doc(db, 'users', delta.uid), {
        mmr: delta.newMMR,
        'stats.matchesWon': isWinner
          ? player.stats.matchesWon + 1
          : player.stats.matchesWon,
        'stats.matchesLost': !isWinner
          ? player.stats.matchesLost + 1
          : player.stats.matchesLost,
      })
    }
  })
}
