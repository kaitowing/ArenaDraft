import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { AppUser, PairPolicy, TournamentCategory, TournamentFormat } from '#/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const DEFAULT_TOURNAMENT_FORMAT: TournamentFormat = 'round_robin'
export const DEFAULT_TOURNAMENT_CATEGORY: TournamentCategory = 'open'
export const CATEGORY_POLICY_MAP: Record<TournamentCategory, PairPolicy> = {
  unisex: 'same_gender',
  mixed: 'mixed_duo',
  open: 'any',
}

export function getPairPolicy(category: TournamentCategory): PairPolicy {
  return CATEGORY_POLICY_MAP[category] ?? 'any'
}

export function validatePairForPolicy(pair: [AppUser, AppUser], policy: PairPolicy) {
  const genders = pair.map((p) => p.gender)
  if (policy === 'any') return true
  if (policy === 'same_gender') {
    return genders.every((g) => g != null) && genders[0] === genders[1]
  }
  if (policy === 'mixed_duo') {
    return genders.includes('male') && genders.includes('female')
  }
  return true
}

export function chunkIntoGroups<T>(items: T[], groupCount: number): T[][] {
  const groups = Array.from({ length: groupCount }, () => [] as T[])
  for (let i = 0; i < items.length; i++) {
    const target = i % groupCount
    groups[target].push(items[i])
  }
  return groups
}
