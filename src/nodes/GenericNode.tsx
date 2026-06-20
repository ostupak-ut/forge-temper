import { memo, type CSSProperties } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Play, Square, X } from 'lucide-react'
import type { FtNode } from '@/store/graphStore'
import { useGraphStore } from '@/store/graphStore'
import { getSpec } from '@/registry/nodeSpecs'
import { resolveNodeIcon } from '@/registry/icons'
import { PORT_COLOR, handleId } from '@/registry/portTypes'
import type { Port } from '@/registry/types'
import type { NodeRunStatus } from '@shared/contracts'
import { runSingleNode, stopCurrentRun } from '@/run/runController'
import { DiscBar } from '@/components/DiscBar'
import { cn } from '@/lib/cn'

// idle/skipped show no ring (just the node's thin border) — a 2px grey ring on
// every node read as "fat white lines" in dark mode. Active states keep a color.
const STATUS_RING: Record<NodeRunStatus, string> = {
  idle: 'ring-transparent',
  queued: 'ring-amber-400/60',
  running: 'ring-temper animate-pulse',
  done: 'ring-emerald-400/70',
  error: 'ring-red-500/80',
  skipped: 'ring-transparent',
}

const STATUS_DOT: Record<NodeRunStatus, string> = {
  idle: 'bg-fg/20',
  queued: 'bg-amber-400',
  running: 'bg-temper',
  done: 'bg-emerald-400',
  error: 'bg-red-500',
  skipped: 'bg-fg/10',
}

function dotStyle(type: Port['type'], side: 'left' | 'right'): CSSProperties {
  return {
    position: 'absolute',
    [side]: -5,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 10,
    height: 10,
    background: PORT_COLOR[type],
    border: '2px solid rgb(var(--bg))',
  }
}

/** One port = one row, so labels never overlap each other or the body. */
function PortRow({ port, dir }: { port: Port; dir: 'in' | 'out' }) {
  const isIn = dir === 'in'
  return (
    <div
      className={cn(
        'relative flex h-6 items-center text-[10px] text-fg/55',
        isIn ? 'pl-3' : 'justify-end pr-3',
      )}
    >
      {isIn && (
        <Handle id={handleId('in', port.id)} type="target" position={Position.Left} style={dotStyle(port.type, 'left')} />
      )}
      <span className="truncate">
        {port.label ?? port.id}
        {port.required && <span className="text-red-400">*</span>}
      </span>
      {!isIn && (
        <Handle
          id={handleId('out', port.id)}
          type="source"
          position={Position.Right}
          style={dotStyle(port.type, 'right')}
        />
      )}
    </div>
  )
}

function GenericNodeImpl({ id, data, selected }: NodeProps<FtNode>) {
  const spec = getSpec(data.kind)
  const Icon = resolveNodeIcon((data.config as { symbol?: unknown })?.symbol, spec.icon)
  const cfgColor = (data.config as { color?: unknown })?.color
  const accent = typeof cfgColor === 'string' && cfgColor ? cfgColor : spec.color
  const run = useGraphStore((s) => s.runState[id])
  const deleteNode = useGraphStore((s) => s.deleteNode)
  const status: NodeRunStatus = run?.status ?? 'idle'
  const runnable = spec.fields.some((f) => f.kind === 'prompt')
  const busy = status === 'running' || status === 'queued'

  return (
    <div
      className={cn(
        'relative w-60 rounded-xl border border-border/10 bg-card shadow-lg ring-2 transition',
        STATUS_RING[status],
        selected && 'outline outline-2 outline-temper/60',
      )}
    >
      {/* header */}
      <div
        className="flex items-center gap-2 rounded-t-xl px-3 py-2"
        style={{ background: `${accent}22`, borderBottom: `1px solid ${accent}55` }}
      >
        <Icon className="size-4 shrink-0" style={{ color: accent }} />
        <span className="truncate text-sm font-medium text-fg/90">{data.label}</span>
        <span className={cn('ml-auto size-2 rounded-full', STATUS_DOT[status])} title={status} />
        {runnable &&
          (busy ? (
            <button
              className="nodrag rounded p-0.5 text-red-300 hover:bg-red-500/20"
              title="Stop"
              onClick={(e) => {
                e.stopPropagation()
                stopCurrentRun()
              }}
            >
              <Square className="size-3.5" />
            </button>
          ) : (
            <button
              className="nodrag rounded p-0.5 text-emerald-300 hover:bg-emerald-500/20"
              title="Run this node"
              onClick={(e) => {
                e.stopPropagation()
                runSingleNode(id)
              }}
            >
              <Play className="size-3.5" />
            </button>
          ))}
        <button
          className="nodrag rounded p-0.5 text-fg/30 hover:bg-red-500/20 hover:text-red-300"
          title="Delete node"
          onClick={(e) => {
            e.stopPropagation()
            deleteNode(id)
          }}
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* ports as columns */}
      {(spec.inputs.length > 0 || spec.outputs.length > 0) && (
        <div className="flex py-1.5">
          {spec.inputs.length > 0 && (
            <div className="min-w-0 flex-1 space-y-0.5">
              {spec.inputs.map((p) => (
                <PortRow key={p.id} port={p} dir="in" />
              ))}
            </div>
          )}
          {spec.outputs.length > 0 && (
            <div className="min-w-0 flex-1 space-y-0.5">
              {spec.outputs.map((p) => (
                <PortRow key={p.id} port={p} dir="out" />
              ))}
            </div>
          )}
        </div>
      )}

      {/* body */}
      <div className="border-t border-border/5 px-3 py-1.5">
        {run?.tail ? (
          <pre className="max-h-16 overflow-hidden whitespace-pre-wrap break-words text-[10px] leading-tight text-fg/45">
            {run.tail.slice(-220)}
          </pre>
        ) : (
          <p className="line-clamp-2 text-[11px] text-fg/35">{spec.description}</p>
        )}
        {run?.verdict && (
          <div className="mt-1.5">
            <DiscBar tally={run.verdict.distribution} allCorrect={run.verdict.allCorrect} />
          </div>
        )}
        {run?.iteration != null && (
          <span className="mt-1 inline-block rounded bg-fg/5 px-1.5 py-0.5 text-[10px] text-fg/50">
            iter {run.iteration}
          </span>
        )}
        {run?.error && <p className="mt-1 text-[10px] text-red-400">{run.error}</p>}
      </div>
    </div>
  )
}

export const GenericNode = memo(GenericNodeImpl)
