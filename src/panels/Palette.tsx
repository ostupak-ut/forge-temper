import { useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { PanelLeftClose, PanelLeftOpen, Sparkles, X } from 'lucide-react'
import { ALL_KINDS, getSpec } from '@/registry/nodeSpecs'
import { resolveNodeIcon } from '@/registry/icons'
import { useGraphStore } from '@/store/graphStore'
import { usePresets } from '@/io/customPresets'
import { DRAG_MIME, DRAG_PRESET } from '@/canvas/FlowCanvas'
import { cn } from '@/lib/cn'
import type { NodeKind } from '@/registry/types'

const COLLAPSE_KEY = 'ft.paletteCollapsed'

export function Palette() {
  const addNode = useGraphStore((s) => s.addNode)
  const addPresetNode = useGraphStore((s) => s.addPresetNode)
  const setSelected = useGraphStore((s) => s.setSelected)
  const presets = usePresets((s) => s.presets)
  const removePreset = usePresets((s) => s.remove)
  const { screenToFlowPosition } = useReactFlow()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')

  const toggle = () =>
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      return next
    })

  // Center of the visible canvas, with a small jitter so repeat clicks don't stack.
  const centerPos = () => {
    const jitter = () => (Math.random() - 0.5) * 90
    return screenToFlowPosition({
      x: window.innerWidth / 2 + jitter(),
      y: window.innerHeight / 2 + jitter(),
    })
  }

  const newCustomAgent = () => {
    const id = addNode('custom', centerPos())
    setSelected(id)
  }

  const onDragStart = (e: React.DragEvent, kind: NodeKind) => {
    e.dataTransfer.setData(DRAG_MIME, kind)
    e.dataTransfer.effectAllowed = 'move'
  }

  const addAtCenter = (kind: NodeKind) => addNode(kind, centerPos())

  const itemCls = (extra = '') =>
    cn(
      'flex items-center rounded-lg border text-left text-xs transition',
      collapsed ? 'justify-center p-2' : 'gap-2 px-2 py-1.5',
      extra,
    )

  return (
    <div
      className={cn(
        'flex h-full shrink-0 flex-col gap-1 overflow-y-auto overflow-x-hidden border-r border-border/10 bg-surface p-2',
        collapsed ? 'w-12 items-center' : 'w-44',
      )}
    >
      <button
        onClick={toggle}
        title={collapsed ? 'Expand palette' : 'Collapse palette'}
        className={cn(
          'mb-1 flex items-center rounded text-fg/40 transition hover:bg-fg/10 hover:text-fg/80',
          collapsed ? 'justify-center p-1.5' : 'gap-1.5 self-start px-1.5 py-1',
        )}
      >
        {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
      </button>

      <button
        draggable
        onDragStart={(e) => onDragStart(e, 'custom')}
        onClick={newCustomAgent}
        title="Create a freely-wireable custom agent — click to add, or drag onto the canvas."
        className={itemCls(
          'mb-2 border-dashed border-temper/60 bg-temper/10 font-medium text-temper hover:border-temper hover:bg-temper/20',
        )}
      >
        <Sparkles className="size-4 shrink-0" />
        {!collapsed && <span className="truncate">Custom Agent</span>}
      </button>

      {presets.length > 0 && (
        <>
          {!collapsed && (
            <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-fg/30">My Agents</p>
          )}
          {presets.map((p) => {
            const Icon = resolveNodeIcon(p.symbol, Sparkles)
            const color = typeof p.config.color === 'string' ? (p.config.color as string) : '#22d3ee'
            return (
              <div
                key={p.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_PRESET, p.id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                title={collapsed ? p.name : undefined}
                className={cn(
                  'group cursor-grab border-cyan-400/20 bg-cyan-400/[0.05] text-fg/85 transition hover:border-cyan-400/40 hover:bg-cyan-400/10 active:cursor-grabbing',
                  itemCls(),
                )}
              >
                <button
                  className={cn('flex min-w-0 items-center text-left', collapsed ? '' : 'flex-1 gap-2')}
                  title={`Add “${p.name}”`}
                  onClick={() => {
                    const id = addPresetNode('custom', centerPos(), p.name, p.config)
                    setSelected(id)
                  }}
                >
                  <Icon className="size-4 shrink-0" style={{ color }} />
                  {!collapsed && <span className="truncate">{p.name}</span>}
                </button>
                {!collapsed && (
                  <button
                    className="rounded p-0.5 text-fg/25 opacity-0 transition hover:bg-red-500/20 hover:text-red-300 group-hover:opacity-100"
                    title="Remove from Palette"
                    onClick={() => removePreset(p.id)}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            )
          })}
        </>
      )}

      {!collapsed && (
        <p className="px-1 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-fg/30">Nodes</p>
      )}
      {ALL_KINDS.filter((kind) => kind !== 'custom' && !getSpec(kind).hidePalette).map((kind) => {
        const spec = getSpec(kind)
        const Icon = spec.icon
        return (
          <button
            key={kind}
            draggable
            onDragStart={(e) => onDragStart(e, kind)}
            onClick={() => addAtCenter(kind)}
            title={collapsed ? spec.label : `${spec.description}\n(click to add, or drag onto the canvas)`}
            className={itemCls('border-border/5 bg-fg/[0.03] text-fg/80 hover:border-border/20 hover:bg-fg/[0.07]')}
          >
            <Icon className="size-4 shrink-0" style={{ color: spec.color }} />
            {!collapsed && <span className="truncate">{spec.label}</span>}
          </button>
        )
      })}
      {!collapsed && (
        <p className="mt-auto px-1 pt-2 text-[10px] leading-tight text-fg/25">
          Click to add, or drag onto the canvas. Save a configured Custom Agent (★ in its Properties panel) to reuse it
          here.
        </p>
      )}
    </div>
  )
}
