import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  increment,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '#/lib/firebase'
import type { AppUser, Match, MedalAward, Tournament, TournamentCategory, TournamentFormat } from '#/types'
import { buildGroupStage, generateRoundRobin, generateRandomPairsRoundRobin } from './algorithms'
import { DEFAULT_TOURNAMENT_CATEGORY, DEFAULT_TOURNAMENT_FORMAT, getPairPolicy, validatePairForPolicy } from '#/lib/utils'

function generateJoinCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

interface CreateTournamentOptions {
  name?: string
  isRoundTrip?: boolean
  randomPairs?: boolean
  format?: TournamentFormat
  category?: TournamentCategory
  groupCount?: number
  advancePerGroup?: number
}

export async function createTournamentLobby(
  createdBy: string,
  { name = 'Torneio do Dia', isRoundTrip = false, randomPairs = false, format = DEFAULT_TOURNAMENT_FORMAT, category = DEFAULT_TOURNAMENT_CATEGORY, groupCount = 2, advancePerGroup = 2 }: CreateTournamentOptions = {},
): Promise<string> {
  const pairPolicy = getPairPolicy(category)
  const tournamentRef = doc(collection(db, 'tournaments'))
  const tournamentData: Partial<Omit<Tournament, 'id'>> = {
    name,
    date: new Date().toISOString().split('T')[0],
    status: 'waiting',
    createdBy,
    joinCode: generateJoinCode(),
    participants: [createdBy],
    winnerTeam: null,
    isRoundTrip: randomPairs ? false : isRoundTrip,
    randomPairs,
    format,
    category,
    pairPolicy,
    bracketGenerated: false,
    createdAt: serverTimestamp() as Tournament['createdAt'],
  }

  if (format === 'classic') {
    const bracketSize = Math.max(advancePerGroup * groupCount, 0)
    tournamentData.groupCount = groupCount
    tournamentData.advancePerGroup = advancePerGroup
    tournamentData.bracketSize = bracketSize
  }

  const batch = writeBatch(db)
  batch.set(tournamentRef, tournamentData)
  await batch.commit()
  return tournamentRef.id
}

export async function joinTournamentByCode(
  code: string,
  uid: string,
): Promise<string> {
  const q = query(
    collection(db, 'tournaments'),
    where('joinCode', '==', code.toUpperCase().trim()),
    where('status', '==', 'waiting'),
    limit(1),
  )
  const snapshot = await getDocs(q)
  if (snapshot.empty) throw new Error('Torneio não encontrado ou já iniciado.')
  
  const tournamentData = snapshot.docs[0].data() as Tournament
  if (tournamentData.participants.includes(uid)) {
    throw new Error('Você já está participando deste torneio.')
  }
  
  const tournamentRef = snapshot.docs[0].ref
  await updateDoc(tournamentRef, {
    participants: arrayUnion(uid),
  })
  return snapshot.docs[0].id
}

export async function addParticipantByOrganizer(
  tournamentId: string,
  organizerUid: string,
  targetUid: string,
): Promise<void> {
  const tournamentRef = doc(db, 'tournaments', tournamentId)
  const tournamentSnap = await getDoc(tournamentRef)
  if (!tournamentSnap.exists()) throw new Error('Torneio não encontrado.')

  const tournament = { id: tournamentSnap.id, ...tournamentSnap.data() } as Tournament
  if (tournament.status !== 'waiting') {
    throw new Error('Só é possível adicionar participantes em torneios aguardando.')
  }
  if (tournament.createdBy !== organizerUid) {
    throw new Error('Apenas o organizador do torneio pode adicionar participantes diretamente.')
  }

  const organizerSnap = await getDoc(doc(db, 'users', organizerUid))
  if (!organizerSnap.exists()) throw new Error('Organizador não encontrado.')
  const organizer = organizerSnap.data() as AppUser
  if (organizer.role !== 'ORGANIZER' && organizer.role !== 'ADMIN') {
    throw new Error('Permissão negada. Apenas organizadores ou admins podem usar esta função.')
  }

  if (tournament.participants.includes(targetUid)) {
    throw new Error('Este jogador já está no torneio.')
  }

  await updateDoc(tournamentRef, {
    participants: arrayUnion(targetUid),
  })
}

export async function startTournament(
  tournamentId: string,
  pairs: [AppUser, AppUser][],
  options?: { format?: TournamentFormat },
): Promise<void> {
  const batch = writeBatch(db)
  const tournamentRef = doc(db, 'tournaments', tournamentId)

  const tournamentSnap = await getDoc(tournamentRef)
  const tournament = { id: tournamentSnap.id, ...tournamentSnap.data() } as Tournament
  const format = options?.format ?? tournament.format ?? DEFAULT_TOURNAMENT_FORMAT
  const policy = tournament.pairPolicy ?? getPairPolicy(tournament.category ?? DEFAULT_TOURNAMENT_CATEGORY)

  // In random pairs mode, pairs are derived from all players — skip manual pair validation
  if (!tournament.randomPairs) {
    const invalidPair = pairs.find((pair) => !validatePairForPolicy(pair, policy))
    if (invalidPair) {
      throw new Error('Há duplas que não respeitam a categoria escolhida. Ajuste antes de iniciar.')
    }
  }

  batch.update(tournamentRef, { status: 'in_progress', format })

  if (format === 'round_robin') {
    if (tournament.randomPairs) {
      // Derive the full player list from the pairs argument (all participants flattened)
      const allPlayers = pairs.flat()
      const matches = generateRandomPairsRoundRobin(allPlayers, {
        tournamentId,
        stage: 'group',
        importanceWeight: 1,
      })
      for (const match of matches) {
        const matchRef = doc(collection(db, 'matches'))
        batch.set(matchRef, match)
      }
    } else {
      const matches = generateRoundRobin(pairs, {
        tournamentId,
        isRoundTrip: tournament.isRoundTrip,
        stage: 'group',
        importanceWeight: 1,
      })
      for (const match of matches) {
        const matchRef = doc(collection(db, 'matches'))
        batch.set(matchRef, match)
      }
    }
  } else {
    const maxGroups = Math.max(1, Math.floor(pairs.length / 2))
    const groupCount = Math.min(tournament.groupCount ?? 2, maxGroups)
    const { groups, matches } = buildGroupStage(pairs, {
      tournamentId,
      groupCount,
      isRoundTrip: false,
    })
    batch.update(tournamentRef, { groups })
    for (const match of matches) {
      const matchRef = doc(collection(db, 'matches'))
      batch.set(matchRef, match)
    }
  }

  await batch.commit()
}

export async function updateTournamentStatus(
  tournamentId: string,
  status: Tournament['status'],
  winnerTeam?: [string, string],
) {
  const ref = doc(db, 'tournaments', tournamentId)
  await updateDoc(ref, {
    status,
    ...(winnerTeam ? { winnerTeam } : {}),
  })
}

function sortPlayerIds(ids: [string, string]): [string, string] {
  return [...ids].sort() as [string, string]
}

function getWinningTeamId(match: Match): string | null {
  const scoreA = match.teamA.score
  const scoreB = match.teamB.score
  if (scoreA == null || scoreB == null || scoreA === scoreB) return null
  if (!match.teamA.teamId || !match.teamB.teamId) return null
  return scoreA > scoreB ? match.teamA.teamId : match.teamB.teamId
}

async function awardOwnerOfTheCourtMedal(tournament: Tournament): Promise<void> {
  if (tournament.format !== 'round_robin') return

  const matchesQuery = query(collection(db, 'matches'), where('tournamentId', '==', tournament.id))
  const matchesSnapshot = await getDocs(matchesQuery)
  const matches = matchesSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Match)
  if (matches.length === 0) return

  const finishedMatches = matches.filter((m) => m.status === 'finished')
  if (finishedMatches.length !== matches.length) return

  type TeamStats = {
    teamId: string
    playerIds: [string, string]
    wins: number
    losses: number
    setDiff: number
    pointDiff: number
  }

  const teamStats = new Map<string, TeamStats>()

  for (const match of finishedMatches) {
    if (!match.teamA.teamId || !match.teamB.teamId) continue
    const scoreA = match.teamA.score ?? 0
    const scoreB = match.teamB.score ?? 0
    const winnerTeamId = getWinningTeamId(match)
    if (!winnerTeamId) continue

    if (!teamStats.has(match.teamA.teamId)) {
      teamStats.set(match.teamA.teamId, {
        teamId: match.teamA.teamId,
        playerIds: sortPlayerIds(match.teamA.playerIds),
        wins: 0,
        losses: 0,
        setDiff: 0,
        pointDiff: 0,
      })
    }
    if (!teamStats.has(match.teamB.teamId)) {
      teamStats.set(match.teamB.teamId, {
        teamId: match.teamB.teamId,
        playerIds: sortPlayerIds(match.teamB.playerIds),
        wins: 0,
        losses: 0,
        setDiff: 0,
        pointDiff: 0,
      })
    }

    const teamAStats = teamStats.get(match.teamA.teamId)!
    const teamBStats = teamStats.get(match.teamB.teamId)!

    if (winnerTeamId === match.teamA.teamId) {
      teamAStats.wins += 1
      teamBStats.losses += 1
    } else {
      teamBStats.wins += 1
      teamAStats.losses += 1
    }

    if (match.scoringFormat === 'sets') {
      teamAStats.setDiff += scoreA - scoreB
      teamBStats.setDiff += scoreB - scoreA
    } else {
      teamAStats.pointDiff += scoreA - scoreB
      teamBStats.pointDiff += scoreB - scoreA
    }
  }

  const ranking = [...teamStats.values()].sort((a, b) => {
    return (
      b.wins - a.wins ||
      a.losses - b.losses ||
      b.setDiff - a.setDiff ||
      b.pointDiff - a.pointDiff ||
      a.teamId.localeCompare(b.teamId)
    )
  })
  const champion = ranking[0]
  if (!champion) return

  const championMatches = finishedMatches.filter(
    (m) => m.teamA.teamId === champion.teamId || m.teamB.teamId === champion.teamId,
  )
  if (championMatches.length === 0) return

  const qualifies = championMatches.every((match) => {
    const winnerTeamId = getWinningTeamId(match)
    if (winnerTeamId !== champion.teamId) return false

    // Confirmed rule: in points mode, winning the game counts as not losing a set.
    if (match.scoringFormat === 'points') return true

    const championIsTeamA = match.teamA.teamId === champion.teamId
    const lostSets = championIsTeamA ? (match.teamB.score ?? 0) : (match.teamA.score ?? 0)
    return lostSets === 0
  })

  if (!qualifies) return

  const batch = writeBatch(db)

  for (const uid of champion.playerIds) {
    const dedupQuery = query(
      collection(db, 'medals'),
      where('uid', '==', uid),
      where('id', '==', 'owner_of_the_court'),
      where('tournamentId', '==', tournament.id),
      limit(1),
    )
    const existing = await getDocs(dedupQuery)
    if (!existing.empty) continue

    const medalRef = doc(collection(db, 'medals'))
    const medal: MedalAward = {
      id: 'owner_of_the_court',
      uid,
      tournamentId: tournament.id,
      awardedAt: Timestamp.now(),
    }
    batch.set(medalRef, medal)
  }

  await batch.commit()
}

export async function completeTournament(tournamentId: string): Promise<void> {
  let completedNow = false
  let tournamentToAward: Tournament | null = null

  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'tournaments', tournamentId)
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Torneio não encontrado')

    const tournament = { id: snap.id, ...snap.data() } as Tournament
    if (tournament.status === 'completed') return
    completedNow = true
    tournamentToAward = tournament

    tx.update(ref, { status: 'completed' })

    for (const uid of tournament.participants ?? []) {
      tx.update(doc(db, 'users', uid), {
        'stats.tournamentsPlayed': increment(1),
      })
    }
  })

  if (completedNow && tournamentToAward) {
    await awardOwnerOfTheCourtMedal(tournamentToAward)
  }
}

export async function forceCompleteTournament(tournamentId: string): Promise<void> {
  await completeTournament(tournamentId)
}

export async function cancelTournament(tournamentId: string): Promise<void> {
  const ref = doc(db, 'tournaments', tournamentId)
  await deleteDoc(ref)
}
