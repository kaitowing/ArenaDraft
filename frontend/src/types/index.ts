import type { Timestamp } from 'firebase/firestore'

export interface City {
  id: string
  name: string
  state?: string
  active: boolean
  order?: number
}

export interface AppUser {
  uid: string
  displayName: string
  photoURL: string | null
  email: string | null
  mmr: number
  cities: string[]
  stats: {
    tournamentsPlayed: number
    matchesWon: number
    matchesLost: number
  }
  createdAt: Timestamp
}

export interface Tournament {
  id: string
  name: string
  date: string
  status: 'waiting' | 'draft' | 'in_progress' | 'completed'
  createdBy: string
  joinCode: string
  participants: string[]
  winnerTeam: [string, string] | null
  isRoundTrip: boolean
  createdAt: Timestamp
}

export interface Team {
  playerIds: [string, string]
  score: number | null
  sets?: number[]
  mmrAverage: number
}

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
}

export type MatchResult = 'teamA' | 'teamB' | null
