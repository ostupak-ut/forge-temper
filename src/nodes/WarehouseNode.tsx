import { memo, useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Archive, ExternalLink, RefreshCw, Trash2, X } from 'lucide-react'
import type { FtNode } from '@/store/graphStore'
import { useGraphStore } from '@/store/graphStore'
import { PORT_COLOR, handleId } from '@/registry/portTypes'
import { EditableTitle, IconColorMenu } from '@/components/NodeChrome'
import { FolderRow, type FsEntry } from '@/components/FileTree'
import { revealInOS } from '@/io/reveal'
import { cn } from '@/lib/cn'

const ACCENT = '#0ea5e9'

const inHandle: CSSProperties = {
  position: 'absolute',
  left: -5,
  top: '50%',
  transform: 'translateY(-50%)',
  width: 10,
  height: 10,
  background: PORT_COLOR.any,
  border: '2px solid rgb(var(--bg))',
}

// Output handle — mirrors the input on the right edge, so the warehouse can also
// tap intermediate output and feed a downstream node.
const outHandle: CSSProperties = { ...inHandle, left: undefined, right: -5 }

function WarehouseNodeImpl({ id, data, selected }: NodeProps<FtNode>) {
  const cfgName = data.config?.warehouseName
  const whName = (typeof cfgName === 'string' && cfgName.trim()) || id
  const base = `warehouse/${whName}`
  const status = useGraphStore((s) => s.runState[id]?.status)
  const deleteNode = useGraphStore((s) => s.deleteNode)
  const setSelected = useGraphStore((s) => s.setSelected)
  const updateNodeConfig = useGraphStore((s) => s.updateNodeConfig)
  const updateNodeLabel = useGraphStore((s) => s.updateNodeLabel)

  const cfgColor = (data.config as { color?: unknown })?.color
  const accent = typeof cfgColor === 'string' && cfgColor ? cfgColor : ACCENT

  const [runs, setRuns] = useState<FsEntry[]>([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    return fetch(`/api/fs/list?path=${encodeURIComponent(base)}`)
      .then((r) => r.json())
      .then((d) =>
        setRuns(
          ((d.items ?? []) as FsEntry[]).filter((i) => i.dir).sort((a, b) => b.name.localeCompare(a.name)),
        ),
      )
      .catch(() => setRuns([]))
      .finally(() => setLoading(false))
  }, [base])

  useEffect(() => {
    void reload()
  }, [reload])

  // Refresh the pile the moment this warehouse finishes archiving a run.
  useEffect(() => {
    if (status === 'done') void reload()
  }, [status, reload])

  const clearPile = async () => {
    if (!window.confirm(`Clear warehouse "${whName}"? This deletes all piled runs from disk.`)) return
    setLoading(true)
    await fetch(`/api/fs/delete?path=${encodeURIComponent(base)}`, { method: 'DELETE' }).catch(() => {})
    await reload()
  }

  return (
    <div
      className={cn(
        'relative w-64 rounded-lg bg-card shadow-lg shadow-black/40 transition',
        'ring-1 ring-sky-400/15',
        selected && 'outline outline-2 outline-temper/60',
      )}
      onClick={() => setSelected(id)}
    >
      {/* header */}
      <div
        className="flex items-center gap-2 rounded-t-lg px-3 py-2"
        style={{ background: `${accent}22`, borderBottom: `1px solid ${accent}55` }}
      >
        <IconColorMenu
          symbol={(data.config as { symbol?: unknown })?.symbol}
          color={accent}
          fallbackIcon={Archive}
          accent={accent}
          onSymbol={(name) => updateNodeConfig(id, 'symbol', name)}
          onColor={(hex) => updateNodeConfig(id, 'color', hex)}
        />
        <EditableTitle
          value={data.label}
          onChange={(v) => updateNodeLabel(id, v)}
          placeholder="Warehouse"
          className="flex-1 text-sm font-medium text-fg/90"
        />
        <span className="rounded bg-fg/10 px-1.5 py-0.5 text-[10px] text-fg/50">
          {runs.length} run{runs.length === 1 ? '' : 's'}
        </span>
        <button
          className="nodrag rounded p-0.5 text-fg/30 hover:bg-fg/10 hover:text-fg/70 disabled:opacity-40"
          title="Refresh"
          disabled={loading}
          onClick={(e) => {
            e.stopPropagation()
            void reload()
          }}
        >
          <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
        </button>
        <button
          className="nodrag rounded p-0.5 text-fg/30 hover:bg-fg/10 hover:text-fg/70"
          title="Open in Finder / Explorer"
          onClick={(e) => {
            e.stopPropagation()
            void revealInOS(base)
          }}
        >
          <ExternalLink className="size-3.5" />
        </button>
        {runs.length > 0 && (
          <button
            className="nodrag rounded p-0.5 text-fg/30 hover:bg-red-500/20 hover:text-red-300"
            title="Clear this warehouse (delete its runs from disk)"
            onClick={(e) => {
              e.stopPropagation()
              void clearPile()
            }}
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
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

      {/* ports: in (left) + out (right) */}
      <div className="relative flex h-6 items-center px-3 text-[10px] text-fg/55">
        <Handle id={handleId('in', 'in')} type="target" position={Position.Left} style={inHandle} />
        <span>in</span>
        <span className="ml-auto text-fg/45">out</span>
        <Handle id={handleId('out', 'out')} type="source" position={Position.Right} style={outHandle} />
      </div>

      {/* run pile */}
      <div className="nowheel max-h-56 overflow-auto border-t border-border/5 px-1.5 py-1.5">
        {runs.length === 0 ? (
          <p className="px-2 py-3 text-center text-[10px] leading-tight text-fg/35">
            No results yet — run the graph;
            <br />
            each run adds a folder here.
          </p>
        ) : (
          runs.map((r) => (
            <FolderRow key={r.rel} rel={r.rel} name={r.name.replace(/^run-/, '#')} depth={0} />
          ))
        )}
      </div>
    </div>
  )
}

export const WarehouseNode = memo(WarehouseNodeImpl)
