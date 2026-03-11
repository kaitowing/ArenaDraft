import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Filter,
  Hash,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  Users,
} from 'lucide-react'
import { AuthGuard } from '#/features/auth/AuthGuard'
import { useAuth } from '#/features/auth/useAuth'
import {
  fetchAdminTournaments,
  migrateUserRoles,
  reopenTournament,
  type AdminTournamentFilters,
  type AdminTournamentsPage,
} from '#/features/admin/adminService'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { useToast } from '#/hooks/useToast'
import type { Tournament } from '#/types'
import type { DocumentSnapshot } from 'firebase/firestore'

export const Route = createFileRoute('/admin/')({ component: AdminPage })

function AdminPage() {
  return (
    <AuthGuard>
      <AdminGuard>
        <AdminContent />
      </AdminGuard>
    </AuthGuard>
  )
}

// ─── Admin Guard ──────────────────────────────────────────────────────────────

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { appUser, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && appUser && appUser.role !== 'ADMIN') {
      void navigate({ to: '/' })
    }
  }, [appUser, loading, navigate])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[var(--cta-primary)]" />
      </div>
    )
  }

  if (!appUser || appUser.role !== 'ADMIN') return null

  return <>{children}</>
}

// ─── Status label helpers ─────────────────────────────────────────────────────

const STATUS_LABELS: Record<Tournament['status'], string> = {
  waiting: 'Aguardando',
  draft: 'Rascunho',
  in_progress: 'Em andamento',
  completed: 'Encerrado',
}

const STATUS_COLORS: Record<Tournament['status'], string> = {
  waiting: 'bg-yellow-100 text-yellow-800',
  draft: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
}

type StatusFilter = Tournament['status'] | 'all'

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'waiting', label: 'Aguardando' },
  { value: 'draft', label: 'Rascunho' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'completed', label: 'Encerrado' },
]

// ─── Main Content ─────────────────────────────────────────────────────────────

function AdminContent() {
  const { toast } = useToast()

  const [activeSection, setActiveSection] = useState<'tournaments' | 'migration'>('tournaments')

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-6">
      {/* Header */}
      <div className="mb-6 rise-in">
        <p className="sport-label text-xs text-[var(--text-muted)]">Painel de controle</p>
        <div className="flex items-center gap-2">
          <Shield className="size-7 text-[var(--cta-primary)]" />
          <h1 className="display-title text-3xl font-bold text-[var(--text-heading)]">Admin</h1>
        </div>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Ações administrativas restritas — use com cuidado.
        </p>
      </div>

      {/* Section Tabs */}
      <div className="mb-6 flex gap-2 rise-in" style={{ animationDelay: '40ms' }}>
        <button
          type="button"
          onClick={() => setActiveSection('tournaments')}
          className={`flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
            activeSection === 'tournaments'
              ? 'bg-[var(--cta-primary)] text-white'
              : 'bg-[var(--surface)] border border-[var(--line)] text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]'
          }`}
        >
          <Filter className="size-4" />
          Torneios
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('migration')}
          className={`flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
            activeSection === 'migration'
              ? 'bg-[var(--cta-primary)] text-white'
              : 'bg-[var(--surface)] border border-[var(--line)] text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]'
          }`}
        >
          <Users className="size-4" />
          Migration
        </button>
      </div>

      {activeSection === 'tournaments' && <TournamentsSection toast={toast} />}
      {activeSection === 'migration' && <MigrationSection toast={toast} />}
    </main>
  )
}

// ─── Tournaments Section ──────────────────────────────────────────────────────

function TournamentsSection({ toast }: { toast: ReturnType<typeof useToast>['toast'] }) {
  const [filters, setFilters] = useState<AdminTournamentFilters>({ status: 'completed' })
  const [idInput, setIdInput] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(false)
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [searched, setSearched] = useState(false)

  const [reopeningId, setReopeningId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function handleSearch(append = false) {
    setLoading(true)
    if (!append) {
      setTournaments([])
      setLastDoc(null)
      setHasMore(false)
    }
    try {
      const activeFilters: AdminTournamentFilters = {
        ...filters,
        tournamentId: idInput.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }
      const page: AdminTournamentsPage = await fetchAdminTournaments(
        activeFilters,
        append ? lastDoc : null,
      )
      setTournaments((prev) => (append ? [...prev, ...page.tournaments] : page.tournaments))
      setLastDoc(page.lastDoc)
      setHasMore(page.hasMore)
      setSearched(true)
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao buscar torneios', description: String(err) })
    } finally {
      setLoading(false)
    }
  }

  async function handleReopen(tournament: Tournament) {
    setReopeningId(tournament.id)
    try {
      await reopenTournament(tournament.id)
      toast({
        title: 'Torneio reaberto',
        description: `"${tournament.name}" voltou para Em andamento.`,
      })
      // Update the tournament status locally
      setTournaments((prev) =>
        prev.map((t) => (t.id === tournament.id ? { ...t, status: 'in_progress' } : t)),
      )
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao reabrir torneio', description: String(err) })
    } finally {
      setReopeningId(null)
    }
  }

  return (
    <div className="space-y-4 rise-in" style={{ animationDelay: '80ms' }}>
      {/* Filters Card */}
      <div className="rounded-3xl border border-[var(--wave-line)] bg-[color-mix(in_oklab,var(--shell)_86%,transparent)] px-4 py-4 shadow-sm backdrop-blur space-y-4">
        <p className="sport-label text-[11px] text-[var(--text-muted)]">Filtros</p>

        {/* Status filter */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Status
          </label>
          <div className="relative">
            <select
              value={filters.status ?? 'all'}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: e.target.value as StatusFilter }))
              }
              className="w-full appearance-none rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--sea-ink)] focus:outline-none"
            >
              {STATUS_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tournament ID */}
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            <Hash className="size-3" />
            ID do Torneio
          </label>
          <Input
            placeholder="Cole o ID do torneio aqui"
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
            className="font-mono text-sm"
          />
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              <CalendarDays className="size-3" />
              De
            </label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-sm"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              <CalendarDays className="size-3" />
              Até
            </label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-sm"
            />
          </div>
        </div>

        <Button
          className="w-full gap-2 rounded-2xl bg-[var(--cta-primary)] hover:bg-[var(--cta-primary-dark)]"
          onClick={() => handleSearch(false)}
          disabled={loading}
        >
          {loading && !tournaments.length ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          Buscar torneios
        </Button>
      </div>

      {/* Results */}
      {searched && (
        <div className="space-y-3">
          {tournaments.length === 0 && !loading ? (
            <div className="surf-card texture-noise flex flex-col items-center gap-3 rounded-3xl px-6 py-12 text-center text-[var(--text-muted)]">
              <Search className="size-10 text-[var(--cta-primary)]" />
              <p className="text-sm">Nenhum torneio encontrado com esses filtros.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wide">
                {tournaments.length} torneio{tournaments.length !== 1 ? 's' : ''} encontrado{tournaments.length !== 1 ? 's' : ''}
              </p>
              {tournaments.map((t) => (
                <TournamentAdminCard
                  key={t.id}
                  tournament={t}
                  expanded={expandedId === t.id}
                  onToggleExpand={() =>
                    setExpandedId((prev) => (prev === t.id ? null : t.id))
                  }
                  onReopen={() => handleReopen(t)}
                  reopening={reopeningId === t.id}
                />
              ))}
              {hasMore && (
                <Button
                  variant="outline"
                  className="w-full rounded-2xl"
                  onClick={() => handleSearch(true)}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="size-4 mr-2" />
                  )}
                  Carregar mais
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Tournament Admin Card ────────────────────────────────────────────────────

function TournamentAdminCard({
  tournament,
  expanded,
  onToggleExpand,
  onReopen,
  reopening,
}: {
  tournament: Tournament
  expanded: boolean
  onToggleExpand: () => void
  onReopen: () => void
  reopening: boolean
}) {
  const [confirming, setConfirming] = useState(false)

  function handleReopenClick() {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setConfirming(false)
    onReopen()
  }

  return (
    <div className="rounded-3xl border border-[var(--wave-line)] bg-[color-mix(in_oklab,var(--shell)_86%,transparent)] shadow-sm backdrop-blur overflow-hidden">
      {/* Main row */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer hover:bg-[color-mix(in_oklab,var(--shell)_70%,transparent)] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[var(--text-heading)] truncate">{tournament.name}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{tournament.date}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[tournament.status]}`}
        >
          {STATUS_LABELS[tournament.status]}
        </span>
        {expanded ? (
          <ChevronUp className="size-4 shrink-0 text-[var(--text-muted)]" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-[var(--text-muted)]" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-[var(--line)] pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <Detail label="ID" value={tournament.id} mono />
            <Detail label="Criado por" value={tournament.createdBy} mono />
            <Detail label="Formato" value={tournament.format} />
            <Detail label="Categoria" value={tournament.category} />
            <Detail label="Participantes" value={String(tournament.participants.length)} />
            <Detail label="Código" value={tournament.joinCode} mono />
          </div>

          {/* Actions */}
          {tournament.status === 'completed' && (
            <div className="pt-2">
              {confirming ? (
                <div className="rounded-2xl border border-yellow-300 bg-yellow-50 p-3 space-y-2">
                  <div className="flex items-start gap-2 text-yellow-800">
                    <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                    <p className="text-xs leading-snug">
                      Isso vai reabrir o torneio e <strong>decrementar</strong> o contador de
                      torneios jogados de cada participante. Confirma?
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="gap-1.5 rounded-xl bg-yellow-600 hover:bg-yellow-700 text-white"
                      onClick={handleReopenClick}
                      disabled={reopening}
                    >
                      {reopening ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="size-3.5" />
                      )}
                      Confirmar reabertura
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => setConfirming(false)}
                      disabled={reopening}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 rounded-xl border-yellow-400 text-yellow-700 hover:bg-yellow-50"
                  onClick={handleReopenClick}
                >
                  <RotateCcw className="size-3.5" />
                  Reabrir torneio
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </p>
      <p
        className={`truncate text-sm text-[var(--text-heading)] ${mono ? 'font-mono' : ''}`}
        title={value}
      >
        {value}
      </p>
    </div>
  )
}

// ─── Migration Section ────────────────────────────────────────────────────────

function MigrationSection({ toast }: { toast: ReturnType<typeof useToast>['toast'] }) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ updated: number; skipped: number } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function handleMigrate() {
    if (!confirming) {
      setConfirming(true)
      // Auto-cancel confirmation after 5 seconds
      timerRef.current = setTimeout(() => setConfirming(false), 5000)
      return
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    setConfirming(false)
    setRunning(true)
    setResult(null)
    try {
      const res = await migrateUserRoles()
      setResult(res)
      toast({
        title: 'Migration concluída',
        description: `${res.updated} usuário${res.updated !== 1 ? 's' : ''} atualizado${res.updated !== 1 ? 's' : ''}. ${res.skipped} já tinham role definido.`,
      })
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro na migration', description: String(err) })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-4 rise-in" style={{ animationDelay: '80ms' }}>
      {/* First Admin instruction */}
      <div className="rounded-3xl border border-[var(--wave-line)] bg-[color-mix(in_oklab,var(--shell)_86%,transparent)] px-5 py-5 shadow-sm backdrop-blur space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="size-5 text-[var(--cta-primary)]" />
          <p className="font-semibold text-[var(--text-heading)]">Como definir o primeiro ADMIN</p>
        </div>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed">
          Como não há nenhum ADMIN ainda, o primeiro precisa ser definido{' '}
          <strong>manualmente via Firebase Console</strong>:
        </p>
        <ol className="list-decimal list-inside space-y-1 text-sm text-[var(--text-muted)]">
          <li>
            Acesse o{' '}
            <span className="font-mono text-xs bg-[var(--surface)] rounded px-1 py-0.5">
              Firebase Console → Firestore → users
            </span>
          </li>
          <li>Encontre o documento do seu usuário (pelo UID ou email)</li>
          <li>
            Adicione o campo{' '}
            <span className="font-mono text-xs bg-[var(--surface)] rounded px-1 py-0.5">
              role: "ADMIN"
            </span>{' '}
            (string)
          </li>
          <li>Salve e recarregue o app</li>
        </ol>
        <p className="text-xs text-[var(--text-muted)]">
          Após o primeiro ADMIN estar definido, ele pode usar a própria tela de admin para gerenciar roles de outros usuários no futuro.
        </p>
      </div>

      {/* Migration card */}
      <div className="rounded-3xl border border-[var(--wave-line)] bg-[color-mix(in_oklab,var(--shell)_86%,transparent)] px-5 py-5 shadow-sm backdrop-blur space-y-4">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-[var(--cta-primary)]" />
          <p className="font-semibold text-[var(--text-heading)]">Setar role USER retroativamente</p>
        </div>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed">
          Define <span className="font-mono text-xs bg-[var(--surface)] rounded px-1 py-0.5">role: "USER"</span> em todos
          os documentos de usuários que ainda não têm o campo <code>role</code> definido. A operação é{' '}
          <strong>segura e idempotente</strong> — pode ser executada múltiplas vezes sem problema.
        </p>

        {confirming ? (
          <div className="rounded-2xl border border-yellow-300 bg-yellow-50 p-3 space-y-2">
            <div className="flex items-start gap-2 text-yellow-800">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              <p className="text-xs leading-snug">
                Isso irá atualizar <strong>todos os usuários sem role</strong> para USER. Confirma?
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="gap-1.5 rounded-xl bg-yellow-600 hover:bg-yellow-700 text-white"
                onClick={handleMigrate}
                disabled={running}
              >
                {running ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Users className="size-3.5" />
                )}
                Confirmar migration
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setConfirming(false)
                  if (timerRef.current) clearTimeout(timerRef.current)
                }}
                disabled={running}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button
            className="gap-2 rounded-2xl bg-[var(--cta-primary)] hover:bg-[var(--cta-primary-dark)]"
            onClick={handleMigrate}
            disabled={running}
          >
            {running ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
            Executar migration de roles
          </Button>
        )}

        {result && (
          <div className="rounded-2xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 space-y-0.5">
            <p className="font-semibold">Migration concluída com sucesso!</p>
            <p>Usuários atualizados: <strong>{result.updated}</strong></p>
            <p>Já tinham role definido: <strong>{result.skipped}</strong></p>
          </div>
        )}
      </div>
    </div>
  )
}
