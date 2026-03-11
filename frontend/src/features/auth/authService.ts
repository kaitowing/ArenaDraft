import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth'
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import type { ImageDoc } from '#/types'
import { auth, db } from '#/lib/firebase'
import { queryClient } from '#/lib/queryClient'
import type { Gender } from '#/types'

export async function signInWithEmail(email: string, password: string) {
  const result = await signInWithEmailAndPassword(auth, email, password)
  return result.user
}

export async function signUpWithEmail(
  name: string,
  email: string,
  password: string,
  cities: string[],
  gender: Gender,
): Promise<any> {
  const result = await createUserWithEmailAndPassword(auth, email, password)
  const user = result.user

  await updateProfile(user, { displayName: name })

  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    displayName: name,
    photoURL: null,
    email,
    mmr: 1200,
    cities,
    gender,
    role: 'USER',
    stats: {
      tournamentsPlayed: 0,
      matchesWon: 0,
      matchesLost: 0,
    },
    createdAt: serverTimestamp(),
  })

  return user
}

export async function sendPasswordReset(email: string) {
  await sendPasswordResetEmail(auth, email)
}

export async function signOut() {
  try {
    await firebaseSignOut(auth)
  } finally {
    queryClient.clear()
  }
}

export async function updateUserProfile(
  uid: string,
  updates: { displayName?: string; cities?: string[]; gender?: Gender | null },
): Promise<void> {
  const userRef = doc(db, 'users', uid)

  // Update Firestore document
  await updateDoc(userRef, updates)

  // Update Firebase Auth profile if displayName changed
  if (updates.displayName && auth.currentUser) {
    await updateProfile(auth.currentUser, { displayName: updates.displayName })
  }
}

export async function updateProfilePhoto(uid: string, base64: string): Promise<void> {
  const imageData: ImageDoc = { base64, updatedAt: serverTimestamp() }
  await setDoc(doc(db, 'images', uid), imageData, { merge: true })
}
