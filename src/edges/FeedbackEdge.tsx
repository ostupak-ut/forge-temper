import { useRef, useState } from 'react'
import { BaseEdge, EdgeLabelRenderer, useReactFlow, type EdgeProps } from '@xyflow/react'
import { useGraphStore } from '@/store/graphStore'

/**
 * The Temper → Forge loop-feedback link — THIS ARROW IS THE LOOP. Animated/dashed/
 * rose, arching over the body. Its `data` carries the loop config (mode +
 * maxIterations, edited via EdgeInspector) AND an optional custom arc position
 * (`arcLift` / `arcShiftX`): SELECT the edge and DRAG the grab handle at the apex
 * to reposition the arc; double-click the handle to snap back to auto.
 *
 * The label shows live loop state from the back-edge TARGET (Forge):
 * `iter N · 🟢v 🔵p 🟠h 🔴c` running, and the configured cap when idle.
 */
export function FeedbackEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, target, data, selected } = props
  const { getZoom } = useReactFlow()
  const updateEdgeData = useGraphStore((s) => s.updateEdgeData)
  const nodes = useGraphStore((s) => s.nodes)
  const cfg = (data ?? {}) as {
    active?: boolean
    isLoop?: boolean
    mode?: string
    maxIterations?: number
    arcLift?: number
    arcShiftX?: number
  }
  // A feedback edge only LOOPS when a forward path closes the cycle (computed in
  // FlowCanvas). Without it, this is a stray edge into a feedback port — draw an
  // honest amber "not a loop" hint, not a fake animated "loop ≤N".
  const isLoop = cfg.isLoop !== false

  // Auto apex: clear the topmost node under the arc's horizontal span.
  const spanMin = Math.min(sourceX, targetX) - 60
  const spanMax = Math.max(sourceX, targetX) + 60
  let topY = Math.min(sourceY, targetY)
  for (const n of nodes) {
    const w = (n as { width?: number; measured?: { width?: number } }).width ?? n.measured?.width ?? 240
    const cx = n.position.x + w / 2
    if (cx >= spanMin && cx <= spanMax) topY = Math.min(topY, n.position.y)
  }
  const baselineY = Math.min(sourceY, targetY)
  const autoLift = baselineY - (topY - 96)

  // Custom position overrides auto when set (by dragging the handle).
  const lift = typeof cfg.arcLift === 'number' ? cfg.arcLift : autoLift
  const shiftX = typeof cfg.arcShiftX === 'number' ? cfg.arcShiftX : 0
  const apexY = baselineY - lift
  const midX = (sourceX + targetX) / 2
  const dx = Math.max(60, Math.abs(sourceX - targetX) * 0.22)
  // Loop AND not-a-loop use the SAME arc, so a not-a-loop edge looks and drags
  // exactly like a loop — only color + label differ (amber + a warning).
  const path = `M ${sourceX},${sourceY} C ${sourceX + dx + shiftX},${apexY} ${targetX - dx + shiftX},${apexY} ${targetX},${targetY}`

  // Grab handle sits at the curve's visual peak.
  const handleX = midX + shiftX
  const handleY = 0.125 * (sourceY + targetY) + 0.75 * apexY
  const labelX = handleX
  // Sit just above the curve's VISUAL peak (handleY), not the higher control apex.
  const labelY = handleY - 14

  const drag = useRef<{ x: number; y: number } | null>(null)
  const [grabbing, setGrabbing] = useState(false)

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY }
    setGrabbing(true)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const z = getZoom() || 1
    const ddx = (e.clientX - drag.current.x) / z
    const ddy = (e.clientY - drag.current.y) / z
    drag.current = { x: e.clientX, y: e.clientY }
    // Read the freshest values from the store to avoid stale-closure drift.
    const ed = useGraphStore.getState().edges.find((x) => x.id === id)
    const d = (ed?.data ?? {}) as { arcLift?: number; arcShiftX?: number }
    const curLift = typeof d.arcLift === 'number' ? d.arcLift : autoLift
    const curShift = typeof d.arcShiftX === 'number' ? d.arcShiftX : 0
    updateEdgeData(id, { arcLift: curLift - ddy, arcShiftX: curShift + ddx })
  }
  const onPointerUp = (e: React.PointerEvent) => {
    drag.current = null
    setGrabbing(false)
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
  }
  const onReset = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateEdgeData(id, { arcLift: undefined, arcShiftX: undefined })
  }

  const run = useGraphStore((s) => s.runState[target])
  const iteration = run?.iteration
  const dist = run?.verdict?.distribution
  const running = isLoop && (cfg.active || iteration != null)

  const color = !isLoop ? (selected ? '#fcd34d' : '#f59e0b') : selected ? '#fecdd3' : '#fb7185'
  const width = selected ? 3.5 : running ? 3 : 2.5
  const markerId = !isLoop ? 'ft-fb-arrow-warn' : running ? 'ft-fb-arrow-on' : 'ft-fb-arrow-off'

  const cap = cfg.maxIterations ?? 3
  const label = !isLoop
    ? '⚠ not a loop — add a forward edge back'
    : iteration != null
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
          className={
            'pointer-events-none whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium shadow-sm ' +
            (isLoop
              ? 'border-rose-400/40 bg-rose-500/25 text-rose-100'
              : 'border-amber-400/50 bg-amber-500/25 text-amber-100')
          }
        >
          {label}
        </div>
        {selected && (
          <div
            className="nodrag nopan"
            title="Drag to reposition the loop arc · double-click to reset"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onDoubleClick={onReset}
            style={{
              position: 'absolute',
              transform: `translate(-50%,-50%) translate(${handleX}px,${handleY}px)`,
              pointerEvents: 'all',
              cursor: grabbing ? 'grabbing' : 'grab',
              width: 16,
              height: 16,
              borderRadius: 9999,
              background: '#fb7185',
              border: '2px solid #fecdd3',
              boxShadow: '0 0 0 4px rgba(251,113,133,0.25)',
            }}
          />
        )}
      </EdgeLabelRenderer>
    </>
  )
}
