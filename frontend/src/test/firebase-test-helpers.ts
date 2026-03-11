/**
 * Firebase helpers for integration tests.
 *
 * Initializes a dedicated client SDK instance using credentials from .env.test
 * (gitignored). The target project must have open Firestore security rules so
 * unauthenticated reads/writes are allowed during tests.
 *
 * All documents created during tests are tracked and deleted in afterAll.
 */
import { initializeApp, getApps, deleteApp, type FirebaseApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  doc,
  type Firestore,
} from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'
import type { AppUser } from '#/types'

// ─── Firebase config (staging project — read from .env.test via process.env) ──
// Copy .env.example to .env.test and fill in your staging project credentials.

const TEST_FIREBASE_CONFIG = {
  apiKey: process.env.VITE_FIREBASE_API_KEY!,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.VITE_FIREBASE_APP_ID!,
}

const TEST_APP_NAME = 'arena-draft-test'

let testApp: FirebaseApp | null = null
let testDb: Firestore | null = null

export function getTestDb(): Firestore {
  if (!testDb) {
    const existing = getApps().find((a) => a.name === TEST_APP_NAME)
    testApp = existing ?? initializeApp(TEST_FIREBASE_CONFIG, TEST_APP_NAME)
    testDb = getFirestore(testApp)
  }
  return testDb
}

export async function teardownTestApp() {
  if (testApp) {
    await deleteApp(testApp)
    testApp = null
    testDb = null
  }
}

// ─── Fixture factories ────────────────────────────────────────────────────────

let userCounter = 0

export function makeTestUser(overrides: Partial<AppUser> = {}): AppUser {
  userCounter++
  return {
    uid: `test-user-${userCounter}-${Date.now()}`,
    displayName: `Test Player ${userCounter}`,
    photoURL: null,
    email: `test${userCounter}@arena.test`,
    mmr: 1000 + userCounter * 50,
    cities: [],
    gender: userCounter % 2 === 0 ? 'female' : 'male',
    stats: { tournamentsPlayed: 0, matchesWon: 0, matchesLost: 0 },
    createdAt: { toDate: () => new Date(), toMillis: () => Date.now() } as unknown as Timestamp,
    ...overrides,
  }
}

export function makePlayers(count: number, overrides: Partial<AppUser> = {}): AppUser[] {
  return Array.from({ length: count }, () => makeTestUser(overrides))
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

/**
 * Deletes all tournament and match documents created during a test run.
 * Uses the same client SDK instance (works because rules are open on staging).
 */
export async function cleanupFirestore(tournamentIds: string[]): Promise<void> {
  if (tournamentIds.length === 0) return

  const db = getTestDb()

  // Firestore `in` supports max 30 values per query
  const chunks: string[][] = []
  for (let i = 0; i < tournamentIds.length; i += 30) {
    chunks.push(tournamentIds.slice(i, i + 30))
  }

  const batch = writeBatch(db)

  for (const id of tournamentIds) {
    batch.delete(doc(db, 'tournaments', id))
  }

  for (const chunk of chunks) {
    const matchesSnap = await getDocs(
      query(collection(db, 'matches'), where('tournamentId', 'in', chunk)),
    )
    for (const d of matchesSnap.docs) {
      batch.delete(d.ref)
    }
  }

  await batch.commit()
}
