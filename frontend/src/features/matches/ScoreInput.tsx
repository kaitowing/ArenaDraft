import type { ChangeEvent } from 'react'

interface ScoreInputProps {
  label: string
  score: number
  onChange: (score: number) => void
  highlight?: boolean
}

export function ScoreInput({ label, score, onChange, highlight }: ScoreInputProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10) || 0
    onChange(Math.max(0, value))
  }

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
      <input
        type="number"
        min={0}
        max={99}
        value={score}
        onChange={handleChange}
        className={`w-40 text-center text-7xl font-bold tabular-nums leading-none bg-transparent border-none outline-none ${
          highlight ? 'text-white' : 'text-[var(--sea-ink)]'
        }`}
        aria-label={`Pontos de ${label}`}
      />
    </div>
  )
}
