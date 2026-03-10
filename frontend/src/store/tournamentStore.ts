import { create } from 'zustand'
import type { AppUser } from '#/types'

interface TournamentStore {
  selectedPlayers: AppUser[]
  addPlayer: (player: AppUser) => void
  removePlayer: (uid: string) => void
  togglePlayer: (player: AppUser) => void
  clearPlayers: () => void
}

export const useTournamentStore = create<TournamentStore>((set, get) => ({
  selectedPlayers: [],

  addPlayer: (player) =>
    set((state) => ({ selectedPlayers: [...state.selectedPlayers, player] })),

  removePlayer: (uid) =>
    set((state) => ({ selectedPlayers: state.selectedPlayers.filter((p) => p.uid !== uid) })),

  togglePlayer: (player) => {
    const { selectedPlayers } = get()
    const exists = selectedPlayers.some((p) => p.uid === player.uid)
    if (exists) {
      set({ selectedPlayers: selectedPlayers.filter((p) => p.uid !== player.uid) })
    } else {
      set({ selectedPlayers: [...selectedPlayers, player] })
    }
  },

  clearPlayers: () => set({ selectedPlayers: [] }),
}))
