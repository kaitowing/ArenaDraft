import type { FieldValue, Timestamp } from 'firebase/firestore'

export interface City {
  id: string
  name: string
  state?: string
  active: boolean
  order?: number
}

export type Gender = 'male' | 'female'

export type UserRole = 'USER' | 'ADMIN'

export type MedalId = 'owner_of_the_court'

export interface MedalAward {
  id: MedalId
  uid: string
  awardedAt: Timestamp
  tournamentId: string
}

export interface AppUser {
  uid: string
  displayName: string
  photoURL: string | null
  email: string | null
  mmr: number
  cities: string[]
  gender: Gender | null
  role: UserRole
  stats: {
    tournamentsPlayed: number
    matchesWon: number
    matchesLost: number
  }
  createdAt: Timestamp
}

export type TournamentFormat = 'round_robin' | 'classic'
export type TournamentCategory = 'unisex' | 'mixed' | 'open'
export type PairPolicy = 'same_gender' | 'mixed_duo' | 'any'

export interface Tournament {
  id: string
  name: string
  date: string
  status: 'waiting' | 'draft' | 'in_progress' | 'completed' | 'cancelled'
  createdBy: string
  joinCode: string
  participants: string[]
  winnerTeam: [string, string] | null
  isRoundTrip: boolean
  format: TournamentFormat
  category: TournamentCategory
  pairPolicy: PairPolicy
  randomPairs?: boolean
  groupCount?: number
  advancePerGroup?: number
  bracketSize?: number
  bracketGenerated?: boolean
  groups?: Array<{
    id: string
    name: string
    teams: Array<Team & {
      wins: number
      losses: number
      points: number
    }>
  }>
  createdAt: Timestamp
}

export interface Team {
  playerIds: [string, string]
  score: number | null
  sets?: number[]
  mmrAverage: number
  genderPattern?: [Gender | null, Gender | null]
  teamId?: string
}

export type MatchStage = 'group' | 'playoff'
export type BracketRound = 'QF' | 'SF' | 'F' | 'R16'

export interface Match {
  id: string
  tournamentId: string
  round: number
  scoringFormat: 'points' | 'sets'
  teamA: Team
  teamB: Team
  status: 'pending' | 'finished'
  submittedBy: string | null
  eloApplied: boolean
  timestamp: Timestamp | null
  stage?: MatchStage
  groupId?: string | null
  bracketRound?: BracketRound
  seedA?: number
  seedB?: number
  importanceWeight?: number
  mmrDeltas?: Array<{ uid: string; delta: number }>
}

export type MatchResult = 'teamA' | 'teamB' | null

export interface ImageDoc {
  base64: string
  updatedAt: Timestamp | FieldValue
}
