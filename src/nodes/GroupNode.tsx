import { memo } from 'react'
import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react'
import { Repeat, X } from 'lucide-react'
import type { FtNode } from '@/store/graphStore'
import { useGraphStore } from '@/store/graphStore'
import { handleId } from '@/registry/portTypes'
import { cn } from '@/lib/cn'

/** The Loop container: holds the Forge↔Temper body, repeated by the driver. */
function GroupNodeImpl({ id, data, selected }: NodeProps<FtNode>) {
  const run = useGraphStore((s) => s.runState[id])
  const deleteNode = useGraphStore((s) => s.deleteNode)
  const cfg = data.config as { mode?: string; maxIterations?: number }

  return (
    <div
      className={cn(
        'h-full w-full rounded-2xl border-2 border-dashed bg-rose-500/5',
        selected ? 'border-rose-400/80' : 'border-rose-400/30',
      )}
    >
      <NodeResizer
        isVisible={!!selected}
        minWidth={320}
        minHeight={200}
        lineClassName="!border-rose-400/50"
        handleClassName="!bg-rose-400 !size-2 !rounded-sm"
      />
      <Handle id={handleId('in', 'in')} type="target" position={Position.Left} style={{ background: '#a855f7' }} />
      <Handle
        id={handleId('out', 'verified')}
        type="source"
        position={Position.Right}
        style={{ background: '#22c55e' }}
      />
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-rose-200/80">
        <Repeat className="size-3.5" />
        <span className="font-medium">{data.label}</span>
        <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px]">
          {cfg.mode === 'until-count' ? `×${cfg.maxIterations ?? 3}` : `smart ≤${cfg.maxIterations ?? 3}`}
        </span>
        {run?.iteration != null && (
          <span className="ml-auto rounded bg-white/10 px-1.5 py-0.5 text-[10px]">iter {run.iteration}</span>
        )}
        <button
          className={cn('nodrag rounded p-0.5 text-rose-200/50 hover:bg-red-500/20 hover:text-red-300', run?.iteration == null && 'ml-auto')}
          title="Delete loop (and its children)"
          onClick={(e) => {
            e.stopPropagation()
            deleteNode(id)
          }}
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

export const GroupNode = memo(GroupNodeImpl)
