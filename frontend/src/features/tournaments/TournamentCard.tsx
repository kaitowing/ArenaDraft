import { Calendar, ChevronRight, Users } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Badge } from '#/components/ui/badge'
import type { Tournament } from '#/types'

interface TournamentCardProps {
  tournament: Tournament
}

const statusConfig = {
  waiting: { label: 'Lobby', variant: 'secondary' as const },
  draft: { label: 'Rascunho', variant: 'secondary' as const },
  in_progress: { label: 'Em Andamento', variant: 'default' as const },
  completed: { label: 'Finalizado', variant: 'success' as const },
}

export function TournamentCard({ tournament }: TournamentCardProps) {
  const status = statusConfig[tournament.status] ?? {
    label: tournament.status,
    variant: 'secondary' as const,
  }
  const dateFormatted = new Date(tournament.date + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  return (
    <Link
      to="/tournaments/$tournamentId"
      params={{ tournamentId: tournament.id }}
      className="block"
    >
      <div className="island-shell rounded-2xl p-4 hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-[var(--sea-ink-soft)]">
              <span className="flex items-center gap-1">
                <Calendar className="size-3.5" />
                {dateFormatted}
              </span>
              <span className="flex items-center gap-1">
                <Users className="size-3.5" />
                {tournament.participants.length} jogadores
              </span>
            </div>
          </div>
          <ChevronRight className="size-5 text-[var(--sea-ink-soft)] shrink-0" />
        </div>
      </div>
    </Link>
  )
}
