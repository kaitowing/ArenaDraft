import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '#/lib/firebase'
import type { AppUser } from '#/types'

interface AuthState {
  user: User | null
  appUser: AppUser | null
  loading: boolean
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, appUser: null, loading: true })

  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // Clean up previous Firestore listener when auth state changes
      if (unsubscribeFirestore) {
        unsubscribeFirestore()
        unsubscribeFirestore = null
      }

      if (!firebaseUser) {
        setState({ user: null, appUser: null, loading: false })
        return
      }

      // Listen to the Firestore user document in real-time
      const userRef = doc(db, 'users', firebaseUser.uid)
      unsubscribeFirestore = onSnapshot(
        userRef,
        (snap) => {
          const appUser = snap.exists() ? ({ uid: snap.id, ...snap.data() } as AppUser) : null
          setState({ user: firebaseUser, appUser, loading: false })
        },
        () => {
          // On error, still set user but without appUser
          setState({ user: firebaseUser, appUser: null, loading: false })
        },
      )
    })

    return () => {
      unsubscribeAuth()
      if (unsubscribeFirestore) unsubscribeFirestore()
    }
  }, [])

  return state
}
