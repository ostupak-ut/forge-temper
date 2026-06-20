import type { DiscTally } from '@shared/contracts'

const DISCS: { key: keyof DiscTally; color: string; label: string }[] = [
  { key: 'v', color: '#22c55e', label: 'Verified' },
  { key: 'p', color: '#3b82f6', label: 'Plausible' },
  { key: 'h', color: '#f59e0b', label: 'Heuristic' },
  { key: 'c', color: '#ef4444', label: 'Conjectured' },
]

/** Confidence-disc tally (🟢🔵🟠🔴) with an "all correct" badge. */
export function DiscBar({ tally, allCorrect }: { tally: DiscTally; allCorrect?: boolean }) {
  const total = tally.v + tally.p + tally.h + tally.c
  if (total === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-fg/60">
      {DISCS.filter((d) => tally[d.key] > 0).map((d) => (
        <span key={d.key} className="flex items-center gap-0.5" title={`${tally[d.key]} ${d.label}`}>
          <span className="inline-block size-2 rounded-full" style={{ background: d.color }} />
          {tally[d.key]}
        </span>
      ))}
      {allCorrect ? (
        <span className="rounded bg-emerald-500/20 px-1 text-emerald-300">all correct</span>
      ) : (
        <span className="rounded bg-amber-500/15 px-1 text-amber-300">{tally.h + tally.c} open</span>
      )}
    </div>
  )
}
