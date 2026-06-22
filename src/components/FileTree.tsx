import { useEffect, useState } from 'react'
import { ChevronRight, ExternalLink, FolderOpen } from 'lucide-react'
import { FileGlyphIcon } from '@/registry/fileIcons'
import { revealInOS } from '@/io/reveal'
import { cn } from '@/lib/cn'

export interface FsEntry {
  name: string
  dir: boolean
  rel: string
  size: number
}

const openRaw = (rel: string) => window.open(`/api/fs/raw?path=${encodeURIComponent(rel)}`, '_blank')

/** A leaf file: type icon + name; opens the raw file in a new tab. */
export function FileLeaf({ rel, name, depth = 0 }: { rel: string; name: string; depth?: number }) {
  return (
    <button
      className="nodrag flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] text-fg/75 hover:bg-fg/10"
      style={{ paddingLeft: 18 + depth * 12 }}
      onClick={() => openRaw(rel)}
      title={`Open ${name}`}
    >
      <FileGlyphIcon name={name} className="size-3.5 shrink-0" />
      <span className="truncate">{name}</span>
    </button>
  )
}

/** A folder row that lazily fetches + reveals its contents, recursively. */
export function FolderRow({
  rel,
  name,
  depth = 0,
  defaultOpen = false,
}: {
  rel: string
  name: string
  depth?: number
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [items, setItems] = useState<FsEntry[] | null>(null)

  useEffect(() => {
    if (!open || items) return
    fetch(`/api/fs/list?path=${encodeURIComponent(rel)}`)
      .then((r) => r.json())
      .then((d) => setItems((d.items ?? []) as FsEntry[]))
      .catch(() => setItems([]))
  }, [open, items, rel])

  const pad = (d: number) => ({ paddingLeft: 6 + d * 12 })

  return (
    <div>
      <div className="group/folder flex items-center" style={pad(depth)}>
        <button
          className="nodrag flex min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] text-fg/80 hover:bg-fg/10"
          onClick={() => setOpen((o) => !o)}
          title={rel}
        >
          <ChevronRight className={cn('size-3 shrink-0 text-fg/40 transition-transform', open && 'rotate-90')} />
          {open ? (
            <FolderOpen className="size-3.5 shrink-0" style={{ color: '#fbbf24' }} />
          ) : (
            <FileGlyphIcon name={name} dir className="size-3.5 shrink-0" />
          )}
          <span className="truncate">{name}</span>
        </button>
        <button
          className="nodrag mr-1 rounded p-0.5 text-fg/20 opacity-0 hover:bg-fg/10 hover:text-fg/70 group-hover/folder:opacity-100"
          title="Reveal in Finder / Explorer"
          onClick={(e) => {
            e.stopPropagation()
            void revealInOS(rel)
          }}
        >
          <ExternalLink className="size-3" />
        </button>
      </div>
      {open && (
        <div>
          {items === null && (
            <p className="py-0.5 text-[10px] text-fg/30" style={{ paddingLeft: 18 + depth * 12 }}>
              …
            </p>
          )}
          {items?.length === 0 && (
            <p className="py-0.5 text-[10px] text-fg/30" style={{ paddingLeft: 18 + depth * 12 }}>
              empty
            </p>
          )}
          {items?.map((it) =>
            it.dir ? (
              <FolderRow key={it.rel} rel={it.rel} name={it.name} depth={depth + 1} />
            ) : (
              <FileLeaf key={it.rel} rel={it.rel} name={it.name} depth={depth + 1} />
            ),
          )}
        </div>
      )}
    </div>
  )
}
