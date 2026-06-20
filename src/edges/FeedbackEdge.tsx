import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react'
import { useGraphStore } from '@/store/graphStore'

/**
 * The Temper → Forge loop-feedback link — THIS ARROW IS THE LOOP. Drawn
 * animated/dashed/rose, arcing cleanly OVER the top of the body. It targets
 * Forge's `loopInternal` port; its `data` carries the loop config (mode +
 * maxIterations), edited by clicking the arrow (see EdgeInspector).
 *
 * The label surfaces the LIVE loop state from the store's runState of the
 * back-edge TARGET node (Forge): `iter N · 🟢v 🔵p 🟠h 🔴c`, and the configured
 * cap when idle.
 */
export function FeedbackEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, target, data, selected } = props

  // Arch HIGH above every node the loop spans, so the arrow clearly wraps around
  // the whole body instead of hiding behind the boxes. Find the topmost node
  // under the arc's horizontal span and clear it by a comfortable margin.
  const nodes = useGraphStore((s) => s.nodes)
  const spanMin = Math.min(sourceX, targetX) - 60
  const spanMax = Math.max(sourceX, targetX) + 60
  let topY = Math.min(sourceY, targetY)
  for (const n of nodes) {
    const w = (n as { width?: number; measured?: { width?: number } }).width ?? n.measured?.width ?? 240
    const cx = n.position.x + w / 2
    if (cx >= spanMin && cx <= spanMax) topY = Math.min(topY, n.position.y)
  }
  const apexY = topY - 96
  const dx = Math.max(60, Math.abs(sourceX - targetX) * 0.22)
  const path = `M ${sourceX},${sourceY} C ${sourceX + dx},${apexY} ${targetX - dx},${apexY} ${targetX},${targetY}`
  const labelX = (sourceX + targetX) / 2
  const labelY = apexY - 4
  const cfg = (data ?? {}) as { active?: boolean; mode?: string; maxIterations?: number }
  const active = Boolean(cfg.active)

  // Pull live loop progress for the back-edge target (Forge).
  const run = useGraphStore((s) => s.runState[target])
  const iteration = run?.iteration
  const dist = run?.verdict?.distribution
  const running = active || iteration != null

  // Always bright + bold so the loop reads at a glance (it's the headline edge).
  const color = selected ? '#fecdd3' : running ? '#fb7185' : '#fb7185'
  const width = selected ? 3.5 : running ? 3 : 2.5
  const markerId = running ? 'ft-fb-arrow-on' : 'ft-fb-arrow-off'

  const cap = cfg.maxIterations ?? 3
  const label =
    iteration != null
      ? `iter ${iteration}${dist ? ` · 🟢${dist.v} 🔵${dist.p} 🟠${dist.h} 🔴${dist.c}` : ''}`
      : `↩ loop ${cfg.mode === 'until-count' ? '×' : '≤'}${cap}`

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={`url(#${markerId})`}
        className="ft-feedback-edge"
        style={{ stroke: color, strokeWidth: width, strokeDasharray: '6 4' }}
      />
      <svg width="0" height="0">
        <defs>
          <marker id={markerId} markerWidth="12" markerHeight="12" refX="9" refY="4" orient="auto">
            <path d="M0,0 L0,8 L10,4 z" fill={color} />
          </marker>
        </defs>
      </svg>
      <EdgeLabelRenderer>
        <div
          style={{ position: 'absolute', transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)` }}
          className="pointer-events-none whitespace-nowrap rounded-full border border-rose-400/40 bg-rose-500/25 px-2 py-0.5 text-[10px] font-medium text-rose-100 shadow-sm"
        >
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
