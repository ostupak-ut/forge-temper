import { memo, useCallback, useState, type CSSProperties } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ExternalLink, Folder, Plus, X } from 'lucide-react'
import type { FtNode } from '@/store/graphStore'
import { useGraphStore } from '@/store/graphStore'
import { PORT_COLOR, handleId } from '@/registry/portTypes'
import { looksLikeFolder } from '@/registry/fileIcons'
import { EditableTitle, IconColorMenu } from '@/components/NodeChrome'
import { FileLeaf, FolderRow } from '@/components/FileTree'
import { collectDropFiles, hasOsFiles, topLevelPaths, uploadDropFiles } from '@/io/fileDrop'
import { revealInOS } from '@/io/reveal'
import { cn } from '@/lib/cn'

const outHandle: CSSProperties = {
  position: 'absolute',
  right: -5,
  top: '50%',
  transform: 'translateY(-50%)',
  width: 10,
  height: 10,
  background: PORT_COLOR.file,
  border: '2px solid rgb(var(--bg))',
}

const baseName = (p: string) => p.split('/').pop() ?? p

function FileNodeImpl({ id, data, selected }: NodeProps<FtNode>) {
  const paths = (Array.isArray(data.config?.paths) ? (data.config.paths as string[]) : []).filter(
    (p): p is string => typeof p === 'string',
  )
  const deleteNode = useGraphStore((s) => s.deleteNode)
  const updateNodeConfig = useGraphStore((s) => s.updateNodeConfig)
  const updateNodeLabel = useGraphStore((s) => s.updateNodeLabel)
  const setSelected = useGraphStore((s) => s.setSelected)
  const [over, setOver] = useState(false)

  const cfgColor = (data.config as { color?: unknown })?.color
  const accent = typeof cfgColor === 'string' && cfgColor ? cfgColor : '#fbbf24'

  const removePath = (p: string) => updateNodeConfig(id, 'paths', paths.filter((x) => x !== p))

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      setOver(false)
      if (!hasOsFiles(e.dataTransfer)) return
      e.preventDefault()
      e.stopPropagation()
      const filesP = collectDropFiles(e.dataTransfer)
      void (async () => {
        const dropped = await filesP
        if (!dropped.length) return
        // Append paths right away; upload bytes in the background.
        const next = [...paths]
        for (const a of topLevelPaths(dropped, 'library')) if (!next.includes(a)) next.push(a)
        updateNodeConfig(id, 'paths', next)
        void uploadDropFiles(dropped, 'library')
      })()
    },
    [id, paths, updateNodeConfig],
  )

  return (
    <div
      className={cn(
        'relative w-64 rounded-lg bg-card shadow-lg shadow-black/40 transition',
        // Manila-folder tint so it reads as "files" at a glance.
        'ring-1 ring-amber-400/15',
        over && 'ring-2 ring-temper',
        selected && 'outline outline-2 outline-temper/60',
      )}
      onClick={() => setSelected(id)}
      onDrop={onDrop}
      onDragOver={(e) => {
        if (!hasOsFiles(e.dataTransfer)) return
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'copy'
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
    >
      {/* folder-tab header */}
      <div
        className="flex items-center gap-2 rounded-t-lg px-3 py-2"
        style={{ background: `${accent}22`, borderBottom: `1px solid ${accent}55` }}
      >
        <IconColorMenu
          symbol={(data.config as { symbol?: unknown })?.symbol}
          color={accent}
          fallbackIcon={Folder}
          accent={accent}
          onSymbol={(name) => updateNodeConfig(id, 'symbol', name)}
          onColor={(hex) => updateNodeConfig(id, 'color', hex)}
        />
        <EditableTitle
          value={data.label}
          onChange={(v) => updateNodeLabel(id, v)}
          placeholder="File"
          className="flex-1 text-sm font-medium text-fg/90"
        />
        <span className="rounded bg-fg/10 px-1.5 py-0.5 text-[10px] text-fg/50">{paths.length}</span>
        <button
          className="nodrag rounded p-0.5 text-fg/30 hover:bg-fg/10 hover:text-fg/70"
          title="Open in Finder / Explorer"
          onClick={(e) => {
            e.stopPropagation()
            void revealInOS(paths.length === 1 ? paths[0] : 'library')
          }}
        >
          <ExternalLink className="size-3.5" />
        </button>
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

      {/* output: files → */}
      <div className="relative flex h-6 items-center justify-end px-3 text-[10px] text-fg/55">
        <span>files</span>
        <Handle id={handleId('out', 'file')} type="source" position={Position.Right} style={outHandle} />
      </div>

      {/* file/folder list */}
      <div className="nowheel max-h-56 overflow-auto border-t border-border/5 px-1.5 py-1.5">
        {paths.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-2 py-4 text-center">
            <Plus className="size-4 text-fg/25" />
            <p className="text-[10px] leading-tight text-fg/35">
              Drop files or a folder here,
              <br />
              or add them in Properties.
            </p>
          </div>
        ) : (
          paths.map((p) => {
            const name = baseName(p.replace(/^library\//, ''))
            const isDir = looksLikeFolder(p)
            return (
              <div key={p} className="group/row flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  {isDir ? <FolderRow rel={p} name={name} depth={0} /> : <FileLeaf rel={p} name={name} depth={0} />}
                </div>
                <button
                  className="nodrag rounded p-0.5 text-fg/20 opacity-0 hover:bg-red-500/20 hover:text-red-300 group-hover/row:opacity-100"
                  title="Remove from this node"
                  onClick={(e) => {
                    e.stopPropagation()
                    removePath(p)
                  }}
                >
                  <X className="size-3" />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export const FileNode = memo(FileNodeImpl)
