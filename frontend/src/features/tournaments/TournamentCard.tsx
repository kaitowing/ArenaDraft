import { Calendar, ChevronRight, Users, Waves, Swords } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import type { Tournament } from '#/types'

interface TournamentCardProps {
  tournament: Tournament
}

const statusConfig = {
  waiting: { label: 'Lobby', className: 'bg-[var(--shell)] text-[var(--cta-primary)]' },
  draft: { label: 'Rascunho', className: 'bg-[var(--shell)] text-[var(--text-muted)]' },
  in_progress: { label: 'Em andamento', className: 'bg-[var(--cta-primary)]/15 text-[var(--cta-primary)]' },
  completed: { label: 'Finalizado', className: 'bg-[var(--palm)]/15 text-[var(--palm)]' },
  cancelled: { label: 'Cancelado', className: 'bg-red-100 text-red-700' },
}

export function TournamentCard({ tournament }: TournamentCardProps) {
  const status = statusConfig[tournament.status] ?? {
    label: tournament.status,
    className: 'bg-[var(--shell)] text-[var(--text-body)]',
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
      <div className="surf-card texture-noise rounded-3xl p-4 hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${status.className}`}>
                {status.label}
              </span>
                <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                <Waves className="size-3" />
                {tournament.participants.length} jogadores
              </span>
              {tournament.format === 'classic' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  <Swords className="size-2.5" />
                  Clássico
                </span>
              )}
              {tournament.category === 'mixed' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                  Misto
                </span>
              )}
              {tournament.category === 'unisex' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                  Unissex
                </span>
              )}
            </div>
            <p className="text-lg font-bold text-[var(--text-heading)]">{tournament.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[var(--text-muted)]">
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
          <ChevronRight className="size-5 text-[var(--text-muted)] shrink-0" />
        </div>
      </div>
    </Link>
  )
}
