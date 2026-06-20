import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, File as FileIcon, Folder, RefreshCw, X } from 'lucide-react'

interface FsEntry {
  name: string
  dir: boolean
  rel: string
  size: number
}

const TEXT_EXT = ['.md', '.tex', '.txt', '.py', '.bib', '.json']

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

export function FileManager({ onClose }: { onClose: () => void }) {
  const [path, setPath] = useState('')
  const [items, setItems] = useState<FsEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ rel: string; ext: string } | null>(null)
  const [text, setText] = useState<string>('')

  const load = useCallback((p: string) => {
    fetch(`/api/fs/list?path=${encodeURIComponent(p)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        else {
          setError(null)
          setItems(d.items)
        }
      })
      .catch((e) => setError(String(e)))
  }, [])

  useEffect(() => load(path), [path, load])

  useEffect(() => {
    if (preview && TEXT_EXT.includes(preview.ext)) {
      fetch(`/api/fs/raw?path=${encodeURIComponent(preview.rel)}`)
        .then((r) => r.text())
        .then(setText)
        .catch(() => setText('(could not read file)'))
    }
  }, [preview])

  const crumbs = path ? path.split('/') : []

  return (
    <div className="flex h-64 shrink-0 flex-col border-t border-white/10 bg-[#0d1320]">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-1.5 text-xs">
        <span className="font-semibold text-white/60">Files</span>
        <button onClick={() => setPath('')} className="text-white/40 hover:text-white/80">
          workspace
        </button>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1 text-white/40">
            <ChevronRight className="size-3" />
            <button
              onClick={() => setPath(crumbs.slice(0, i + 1).join('/'))}
              className="hover:text-white/80"
            >
              {c}
            </button>
          </span>
        ))}
        <button onClick={() => load(path)} className="ml-auto rounded p-1 hover:bg-white/10" title="Refresh">
          <RefreshCw className="size-3.5 text-white/40" />
        </button>
        <button onClick={onClose} className="rounded p-1 hover:bg-white/10" title="Close">
          <X className="size-3.5 text-white/40" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="w-1/3 overflow-auto border-r border-white/10 p-1">
          {error && <p className="p-2 text-[11px] text-red-400">{error}</p>}
          {!error && items.length === 0 && <p className="p-2 text-[11px] text-white/30">empty</p>}
          {items.map((it) => (
            <button
              key={it.rel}
              onClick={() => (it.dir ? setPath(it.rel) : setPreview({ rel: it.rel, ext: extOf(it.name) }))}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] text-white/70 hover:bg-white/10"
            >
              {it.dir ? (
                <Folder className="size-3.5 shrink-0 text-amber-300/80" />
              ) : (
                <FileIcon className="size-3.5 shrink-0 text-white/40" />
              )}
              <span className="truncate">{it.name}</span>
              {!it.dir && <span className="ml-auto text-white/25">{(it.size / 1024).toFixed(0)}k</span>}
            </button>
          ))}
        </div>

        <div className="min-w-0 flex-1 overflow-auto">
          {!preview && <p className="p-3 text-[11px] text-white/30">Select a file to preview.</p>}
          {preview?.ext === '.pdf' && (
            <iframe
              title={preview.rel}
              src={`/api/fs/raw?path=${encodeURIComponent(preview.rel)}`}
              className="h-full w-full bg-white"
            />
          )}
          {preview && ['.png', '.jpg', '.jpeg', '.svg'].includes(preview.ext) && (
            <img src={`/api/fs/raw?path=${encodeURIComponent(preview.rel)}`} alt={preview.rel} className="max-w-full" />
          )}
          {preview && TEXT_EXT.includes(preview.ext) && (
            <pre className="whitespace-pre-wrap p-3 font-mono text-[11px] leading-snug text-white/70">{text}</pre>
          )}
        </div>
      </div>
    </div>
  )
}
