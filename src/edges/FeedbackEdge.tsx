import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react'

/**
 * The Temper → Forge loop-feedback link. Drawn dashed/rose, arcing cleanly OVER
 * the top of the body (a feedback loop reads better above than sagging below),
 * but it targets Forge's `loopInternal` port, so the scheduler treats it as
 * decorative (the loop driver carries the real feedback). Marches while active.
 */
export function FeedbackEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, data } = props
  // Arch up to a SINGLE apex above BOTH endpoints (pinning each control to its
  // own endpoint height made it sag asymmetrically). Flat-topped bridge clears
  // both node boxes regardless of which handle sits higher.
  const lift = 118
  const apexY = Math.min(sourceY, targetY) - lift
  const dx = 22
  const path = `M ${sourceX},${sourceY} C ${sourceX + dx},${apexY} ${targetX - dx},${apexY} ${targetX},${targetY}`
  const labelX = (sourceX + targetX) / 2
  const labelY = apexY - 2
  const active = Boolean((data as { active?: boolean } | undefined)?.active)
  const color = active ? '#fb7185' : '#fb718599'
  const markerId = active ? 'ft-fb-arrow-on' : 'ft-fb-arrow-off'

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={`url(#${markerId})`}
        className={active ? 'ft-feedback-edge' : undefined}
        style={{ stroke: color, strokeWidth: 2, strokeDasharray: '5 4' }}
      />
      <svg width="0" height="0">
        <defs>
          <marker id={markerId} markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={color} />
          </marker>
        </defs>
      </svg>
      <EdgeLabelRenderer>
        <div
          style={{ position: 'absolute', transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)` }}
          className="pointer-events-none rounded bg-rose-500/15 px-1 text-[9px] text-rose-200/80"
        >
          ↩ feedback
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
