import { useReactFlow } from '@xyflow/react'
import { Sparkles, X } from 'lucide-react'
import { ALL_KINDS, getSpec } from '@/registry/nodeSpecs'
import { resolveNodeIcon } from '@/registry/icons'
import { useGraphStore } from '@/store/graphStore'
import { usePresets } from '@/io/customPresets'
import { DRAG_MIME, DRAG_PRESET } from '@/canvas/FlowCanvas'
import type { NodeKind } from '@/registry/types'

export function Palette() {
  const addNode = useGraphStore((s) => s.addNode)
  const addPresetNode = useGraphStore((s) => s.addPresetNode)
  const setSelected = useGraphStore((s) => s.setSelected)
  const presets = usePresets((s) => s.presets)
  const removePreset = usePresets((s) => s.remove)
  const { screenToFlowPosition } = useReactFlow()

  // Center of the visible canvas, with a small jitter so repeat clicks don't stack.
  const centerPos = () => {
    const jitter = () => (Math.random() - 0.5) * 90
    return screenToFlowPosition({
      x: window.innerWidth / 2 + jitter(),
      y: window.innerHeight / 2 + jitter(),
    })
  }

  // Add a fresh custom agent and select it so the user can name + prompt it immediately.
  const newCustomAgent = () => {
    const id = addNode('custom', centerPos())
    setSelected(id)
  }

  const onDragStart = (e: React.DragEvent, kind: NodeKind) => {
    e.dataTransfer.setData(DRAG_MIME, kind)
    e.dataTransfer.effectAllowed = 'move'
  }

  // Click-to-add: drop near the visible canvas center with a little jitter.
  const addAtCenter = (kind: NodeKind) => {
    addNode(kind, centerPos())
  }

  return (
    <div className="flex h-full w-44 shrink-0 flex-col gap-1 overflow-auto border-r border-white/10 bg-[#0d1320] p-2">
      <button
        draggable
        onDragStart={(e) => onDragStart(e, 'custom')}
        onClick={newCustomAgent}
        title="Create a freely-wireable custom agent — click to add, or drag onto the canvas."
        className="mb-2 flex items-center gap-2 rounded-lg border border-dashed border-temper/60 bg-temper/10 px-2 py-2 text-left text-xs font-medium text-temper transition hover:border-temper hover:bg-temper/20"
      >
        <Sparkles className="size-4 shrink-0" />
        <span className="truncate">New Custom Agent</span>
      </button>

      {presets.length > 0 && (
        <>
          <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/30">My Agents</p>
          {presets.map((p) => {
            const Icon = resolveNodeIcon(p.symbol, Sparkles)
            return (
              <div
                key={p.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_PRESET, p.id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                className="group flex cursor-grab items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] px-2 py-1.5 text-xs text-white/85 transition hover:border-cyan-400/40 hover:bg-cyan-400/10 active:cursor-grabbing"
              >
                <button
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  title={`Add “${p.name}”`}
                  onClick={() => {
                    const id = addPresetNode('custom', centerPos(), p.name, p.config)
                    setSelected(id)
                  }}
                >
                  <Icon
                    className="size-4 shrink-0"
                    style={{ color: typeof p.config.color === 'string' ? (p.config.color as string) : '#22d3ee' }}
                  />
                  <span className="truncate">{p.name}</span>
                </button>
                <button
                  className="rounded p-0.5 text-white/25 opacity-0 transition hover:bg-red-500/20 hover:text-red-300 group-hover:opacity-100"
                  title="Remove from Palette"
                  onClick={() => removePreset(p.id)}
                >
                  <X className="size-3" />
                </button>
              </div>
            )
          })}
        </>
      )}

      <p className="px-1 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-white/30">Nodes</p>
      {ALL_KINDS.map((kind) => {
        const spec = getSpec(kind)
        const Icon = spec.icon
        return (
          <button
            key={kind}
            draggable
            onDragStart={(e) => onDragStart(e, kind)}
            onClick={() => addAtCenter(kind)}
            title={`${spec.description}\n(click to add, or drag onto the canvas)`}
            className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1.5 text-left text-xs text-white/80 transition hover:border-white/20 hover:bg-white/[0.07]"
          >
            <Icon className="size-4 shrink-0" style={{ color: spec.color }} />
            <span className="truncate">{spec.label}</span>
          </button>
        )
      })}
      <p className="mt-auto px-1 pt-2 text-[10px] leading-tight text-white/25">
        Click to add, or drag onto the canvas. Save a configured Custom Agent (★ in its Inspector) to reuse it here.
      </p>
    </div>
  )
}
