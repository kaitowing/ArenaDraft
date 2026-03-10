import { useState } from 'react'
import { Users } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import type { AppUser } from '#/types'
import { snakeDraft, type Pair } from './algorithms'

interface PairEditorProps {
  players: AppUser[]
  onConfirm: (pairs: Pair[]) => void
  loading?: boolean
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export function PairEditor({ players, onConfirm, loading }: PairEditorProps) {
  const [pairs, setPairs] = useState<Pair[]>(() => snakeDraft(players))
  const [selected, setSelected] = useState<{ pairIdx: number; slot: 0 | 1 } | null>(null)

  function handleSelect(pairIdx: number, slot: 0 | 1) {
    if (selected === null) {
      setSelected({ pairIdx, slot })
      return
    }

    if (selected.pairIdx === pairIdx && selected.slot === slot) {
      setSelected(null)
      return
    }

    const newPairs = pairs.map((p) => [...p] as Pair)
    const a = newPairs[selected.pairIdx][selected.slot]
    const b = newPairs[pairIdx][slot]
    newPairs[selected.pairIdx][selected.slot] = b
    newPairs[pairIdx][slot] = a
    setPairs(newPairs)
    setSelected(null)
  }

  function isSelected(pairIdx: number, slot: 0 | 1) {
    return selected?.pairIdx === pairIdx && selected?.slot === slot
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-[var(--sea-ink-soft)] mb-3">
          Toque em dois jogadores de duplas diferentes para trocar.
        </p>
        <div className="space-y-2">
          {pairs.map((pair, pairIdx) => {
            const mmrAvg = Math.round((pair[0].mmr + pair[1].mmr) / 2)
            return (
              <div key={pairIdx} className="island-shell rounded-2xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="island-kicker text-xs flex items-center gap-1">
                    <Users className="size-3" />
                    Dupla {pairIdx + 1}
                  </span>
                  <Badge variant="secondary" className="text-xs">{mmrAvg} MMR</Badge>
                </div>
                <div className="flex gap-2">
                  {([0, 1] as const).map((slot) => {
                    const player = pair[slot]
                    const active = isSelected(pairIdx, slot)
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => handleSelect(pairIdx, slot)}
                        className={`flex flex-1 items-center gap-2 rounded-xl px-3 py-2 transition-all cursor-pointer border-2 ${
                          active
                            ? 'border-[var(--lagoon-deep)] bg-[var(--foam)]'
                            : 'border-transparent bg-[var(--surface-alt,#f4f4f5)] hover:border-[var(--line)]'
                        }`}
                      >
                        <Avatar className="h-7 w-7 flex-shrink-0">
                          <AvatarImage src={player.photoURL ?? undefined} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(player.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 text-left">
                          <p className="text-sm font-medium text-[var(--sea-ink)] truncate">
                            {player.displayName}
                          </p>
                          <p className="text-xs text-[var(--sea-ink-soft)]">{player.mmr}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Button
        className="w-full"
        onClick={() => onConfirm(pairs)}
        disabled={loading}
      >
        {loading ? 'Iniciando…' : 'Confirmar duplas e começar'}
      </Button>
    </div>
  )
}
