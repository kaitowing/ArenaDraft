import { Minus, Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'

interface ScoreInputProps {
  label: string
  score: number
  onIncrement: () => void
  onDecrement: () => void
  highlight?: boolean
}

export function ScoreInput({ label, score, onIncrement, onDecrement, highlight }: ScoreInputProps) {
  return (
    <div
      className={`flex flex-col items-center gap-4 rounded-3xl p-6 transition-all ${
        highlight
          ? 'bg-[var(--lagoon-deep)] text-white shadow-xl'
          : 'bg-[var(--surface)] border border-[var(--line)]'
      }`}
    >
      <p
        className={`text-sm font-semibold tracking-wide uppercase ${
          highlight ? 'text-white/80' : 'text-[var(--sea-ink-soft)]'
        }`}
      >
        {label}
      </p>
      <span
        className={`text-7xl font-bold tabular-nums leading-none ${
          highlight ? 'text-white' : 'text-[var(--sea-ink)]'
        }`}
      >
        {score}
      </span>
      <div className="flex gap-4">
        <Button
          size="xl"
          variant={highlight ? 'outline' : 'default'}
          onClick={onDecrement}
          disabled={score <= 0}
          className={
            highlight
              ? 'border-white/30 bg-white/10 text-white hover:bg-white/20 h-16 w-16 rounded-2xl text-2xl'
              : 'h-16 w-16 rounded-2xl text-2xl'
          }
          aria-label={`Diminuir placar de ${label}`}
        >
          <Minus className="size-6" />
        </Button>
        <Button
          size="xl"
          variant={highlight ? 'secondary' : 'default'}
          onClick={onIncrement}
          className={
            highlight
              ? 'bg-white text-[var(--lagoon-deep)] hover:bg-white/90 h-16 w-16 rounded-2xl text-2xl font-bold'
              : 'h-16 w-16 rounded-2xl text-2xl'
          }
          aria-label={`Aumentar placar de ${label}`}
        >
          <Plus className="size-6" />
        </Button>
      </div>
    </div>
  )
}
