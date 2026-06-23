import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AGENT_ICONS, ICON_NAMES, resolveNodeIcon } from '@/registry/icons'
import { cn } from '@/lib/cn'

/** Click a node's title to rename it inline on the canvas. */
export function EditableTitle({
  value,
  onChange,
  className,
  placeholder = 'untitled',
}: {
  value: string
  onChange: (next: string) => void
  className?: string
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const start = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDraft(value)
    setEditing(true)
  }
  const commit = () => {
    setEditing(false)
    const v = draft.trim()
    if (v && v !== value) onChange(v)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(false)
        }}
        className={cn(
          'nodrag min-w-0 flex-1 rounded border border-temper/50 bg-bg/60 px-1 py-0 text-sm font-medium text-fg/90 outline-none',
          className,
        )}
      />
    )
  }
  return (
    <button
      className={cn('min-w-0 truncate text-left', className)}
      onDoubleClick={start}
      title="Double-click to rename"
    >
      {value || <span className="italic text-fg/40">{placeholder}</span>}
    </button>
  )
}

const SWATCHES = [
  '#8b5cf6', '#a855f7', '#e8743b', '#3b9ae8', '#22c55e', '#eab308',
  '#14b8a6', '#0ea5e9', '#22d3ee', '#f43f5e', '#f59e0b', '#ec4899',
  '#84cc16', '#64748b',
]

/**
 * The node's icon, clickable to open a small popover that customizes the icon
 * (avatar) and accent color — right on the canvas, no menu needed.
 */
export function IconColorMenu({
  symbol,
  color,
  fallbackIcon,
  accent,
  onSymbol,
  onColor,
  iconStyle,
}: {
  symbol: unknown
  color: string
  fallbackIcon: LucideIcon
  accent: string
  onSymbol: (name: string) => void
  onColor: (hex: string) => void
  iconStyle?: CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const Icon = resolveNodeIcon(symbol, fallbackIcon)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        className="-m-0.5 rounded p-0.5 hover:bg-fg/10"
        title="Double-click to change icon & color"
        onDoubleClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        <Icon className="size-4 shrink-0" style={iconStyle ?? { color: accent }} />
      </button>
      {open && (
        <div
          className="nodrag nowheel absolute left-0 top-full z-50 mt-1 w-44 rounded-lg border border-border/20 bg-card p-2 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-2 flex flex-wrap items-center gap-1">
            {SWATCHES.map((c) => (
              <button
                key={c}
                onClick={() => onColor(c)}
                title={c}
                className={cn(
                  'size-4 rounded-full ring-1 ring-black/20 transition hover:scale-110',
                  color.toLowerCase() === c && 'outline outline-2 outline-offset-1 outline-fg/60',
                )}
                style={{ background: c }}
              />
            ))}
            <label
              className="grid size-4 cursor-pointer place-items-center overflow-hidden rounded-full ring-1 ring-black/20"
              title="Custom color"
              style={{ background: color }}
            >
              <input
                type="color"
                value={color}
                onChange={(e) => onColor(e.target.value)}
                className="size-6 cursor-pointer opacity-0"
              />
            </label>
          </div>
          <div className="grid max-h-32 grid-cols-6 gap-0.5 overflow-auto">
            {ICON_NAMES.map((name) => {
              const I = AGENT_ICONS[name]
              const active = symbol === name
              return (
                <button
                  key={name}
                  onClick={() => onSymbol(name)}
                  title={name}
                  className={cn('grid place-items-center rounded p-1 hover:bg-fg/10', active && 'bg-fg/15')}
                >
                  <I className="size-3.5" style={{ color: accent }} />
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
