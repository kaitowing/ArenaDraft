import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth } from './useAuth'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: '/login' })
    }
  }, [user, loading, navigate])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--lagoon)] border-t-transparent" />
      </div>
    )
  }

  if (!user) return null

  return <>{children}</>
}
