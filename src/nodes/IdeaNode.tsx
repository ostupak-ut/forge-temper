import { memo, type CSSProperties } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { GripVertical, StickyNote, X } from 'lucide-react'
import type { FtNode } from '@/store/graphStore'
import { useGraphStore } from '@/store/graphStore'
import { PORT_COLOR, handleId } from '@/registry/portTypes'
import { EditableTitle, IconColorMenu } from '@/components/NodeChrome'
import { cn } from '@/lib/cn'

const outHandle: CSSProperties = {
  position: 'absolute',
  right: -5,
  top: '50%',
  transform: 'translateY(-50%)',
  width: 10,
  height: 10,
  background: PORT_COLOR.idea,
  border: '2px solid rgb(var(--bg))',
}

/** A sticky note: type the prompt directly on the canvas. Feeds Forge as the seed. */
function IdeaNodeImpl({ id, data, selected }: NodeProps<FtNode>) {
  const text = typeof data.config?.text === 'string' ? (data.config.text as string) : ''
  const cfgColor = (data.config as { color?: unknown })?.color
  const color = typeof cfgColor === 'string' && cfgColor ? cfgColor : '#fbbf24'
  // color-mix keeps any chosen color a readable pastel paper, dark text always legible.
  const body = `color-mix(in srgb, ${color} 32%, white)`
  const head = `color-mix(in srgb, ${color} 58%, white)`

  const updateNodeConfig = useGraphStore((s) => s.updateNodeConfig)
  const updateNodeLabel = useGraphStore((s) => s.updateNodeLabel)
  const deleteNode = useGraphStore((s) => s.deleteNode)
  const setSelected = useGraphStore((s) => s.setSelected)

  return (
    <div
      className={cn(
        'relative w-56 rounded-md text-slate-900 shadow-lg shadow-black/40 transition',
        selected && 'outline outline-2 outline-temper',
      )}
      style={{ background: body }}
      onClick={() => setSelected(id)}
    >
      {/* drag handle / title bar */}
      <div className="flex items-center gap-1 rounded-t-md px-2 py-1" style={{ background: head }}>
        <GripVertical className="size-3.5 shrink-0 text-slate-900/40" />
        <IconColorMenu
          symbol={(data.config as { symbol?: unknown })?.symbol}
          color={color}
          fallbackIcon={StickyNote}
          accent={color}
          onSymbol={(name) => updateNodeConfig(id, 'symbol', name)}
          onColor={(hex) => updateNodeConfig(id, 'color', hex)}
        />
        <EditableTitle
          value={data.label}
          onChange={(v) => updateNodeLabel(id, v)}
          placeholder="Prompt"
          className="flex-1 text-[12px] font-semibold text-slate-900/80"
        />
        <button
          className="nodrag rounded p-0.5 text-slate-900/50 hover:bg-red-500/20 hover:text-red-700"
          title="Delete note"
          onClick={(e) => {
            e.stopPropagation()
            deleteNode(id)
          }}
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* inline-editable body */}
      <textarea
        value={text}
        onChange={(e) => updateNodeConfig(id, 'text', e.target.value)}
        placeholder="Type your idea / prompt here…"
        spellCheck={false}
        className="nodrag nowheel block min-h-[7rem] w-full resize-y rounded-b-md border-0 bg-transparent px-2.5 py-2 font-medium text-[12px] leading-snug text-slate-900 outline-none placeholder:text-slate-900/30"
      />

      <Handle id={handleId('out', 'idea')} type="source" position={Position.Right} style={outHandle} />
    </div>
  )
}

export const IdeaNode = memo(IdeaNodeImpl)
