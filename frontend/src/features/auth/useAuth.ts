import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '#/lib/firebase'

interface AuthState {
  user: User | null
  loading: boolean
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true })

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setState({ user, loading: false })
    })
    return unsubscribe
  }, [])

  return state
}
