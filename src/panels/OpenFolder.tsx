import { useEffect, useState } from 'react'
import { ArrowUp, Check, FolderOpen, FolderPlus, Home, X } from 'lucide-react'

interface BrowseState {
  path: string
  parent: string | null
  home: string
  dirs: { name: string; path: string }[]
}

const baseName = (p: string) => p.replace(/[/\\]+$/, '').split(/[/\\]/).pop() || p

/**
 * VSCode-style "Open Folder": navigate the real filesystem (server-side via
 * /api/fs/browse) and pick a root. Choosing sets the workspace root and reloads
 * the window into it — the graph autosaves, so nothing is lost.
 */
export function OpenFolder({
  current,
  onClose,
  onChosen,
}: {
  current?: string
  onClose: () => void
  onChosen: (dir: string) => void
}) {
  const [b, setB] = useState<BrowseState | null>(null)
  const [manual, setManual] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const go = async (p?: string) => {
    setError('')
    try {
      const r = await fetch(`/api/fs/browse${p ? `?path=${encodeURIComponent(p)}` : ''}`)
      const d = await r.json()
      if (d.path) {
        setB({ path: d.path, parent: d.parent ?? null, home: d.home, dirs: d.dirs ?? [] })
        setManual(d.path)
      } else setError(d.error ?? 'Cannot open that folder.')
    } catch (e) {
      setError(String(e))
    }
  }

  useEffect(() => {
    void go(current || undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const newFolder = async () => {
    if (!b) return
    const name = window.prompt('New folder name (created inside the current folder):')?.trim()
    if (!name) return
    try {
      const r = await fetch(`/api/fs/mkdir?path=${encodeURIComponent(`${b.path}/${name}`)}`, { method: 'POST' })
      const d = await r.json()
      if (d.ok) void go(b.path)
      else setError(d.error ?? 'Could not create folder.')
    } catch (e) {
      setError(String(e))
    }
  }

  const choose = async () => {
    if (!b) return
    setBusy(true)
    setError('')
    try {
      const r = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceDir: b.path }),
      })
      const d = await r.json()
      if (!d.ok) {
        setError(d.error ?? 'Failed to set this folder.')
        setBusy(false)
        return
      }
      onChosen(d.workspaceDir ?? b.path)
    } catch (e) {
      setError(String(e))
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-[34rem] flex-col rounded-xl border border-border/15 bg-card text-fg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border/10 px-4 py-3">
          <FolderOpen className="size-4 text-emerald-300" />
          <h2 className="text-sm font-semibold text-fg/90">Open Folder</h2>
          <button onClick={onClose} className="ml-auto rounded p-1 text-fg/40 hover:bg-fg/10">
            <X className="size-4" />
          </button>
        </div>

        {/* path bar */}
        <div className="flex shrink-0 items-center gap-1 border-b border-border/10 px-3 py-2">
          <button
            disabled={!b?.parent}
            onClick={() => b?.parent && go(b.parent)}
            title="Up one level"
            className="rounded p-1.5 text-fg/55 hover:bg-fg/10 disabled:opacity-30"
          >
            <ArrowUp className="size-4" />
          </button>
          <button
            onClick={() => b && go(b.home)}
            title="Home"
            className="rounded p-1.5 text-fg/55 hover:bg-fg/10"
          >
            <Home className="size-4" />
          </button>
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && go(manual.trim())}
            spellCheck={false}
            placeholder="/absolute/path"
            className="min-w-0 flex-1 rounded-md border border-border/15 bg-field px-2 py-1 font-mono text-xs text-fg/85 outline-none focus:border-temper"
          />
          <button
            onClick={newFolder}
            title="Create a new folder here"
            className="flex items-center gap-1 rounded-md border border-border/15 bg-fg/5 px-2 py-1 text-[11px] text-fg/70 hover:bg-fg/10"
          >
            <FolderPlus className="size-3.5" /> New
          </button>
        </div>

        {/* subfolder list */}
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {error && <p className="px-2 py-1 text-[11px] text-rose-400">{error}</p>}
          {b && b.dirs.length === 0 && !error && (
            <p className="px-2 py-3 text-center text-[11px] text-fg/30">No subfolders here — open this one below.</p>
          )}
          {b?.dirs.map((d) => (
            <button
              key={d.path}
              onClick={() => go(d.path)}
              onDoubleClick={() => go(d.path)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-fg/80 hover:bg-fg/10"
            >
              <FolderOpen className="size-4 shrink-0 text-amber-300/80" />
              <span className="truncate">{d.name}</span>
            </button>
          ))}
        </div>

        {/* footer */}
        <div className="flex shrink-0 items-center gap-2 border-t border-border/10 px-4 py-3">
          <span className="min-w-0 flex-1 truncate text-[11px] text-fg/45">
            Sets <code className="text-fg/65">library/ · papers/ · warehouse/</code> root here.
          </span>
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-xs text-fg/50 hover:bg-fg/10">
            Cancel
          </button>
          <button
            onClick={choose}
            disabled={busy || !b}
            className="flex items-center gap-1.5 rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
          >
            <Check className="size-3.5" />
            {busy ? 'Opening…' : b ? `Open “${baseName(b.path)}”` : 'Open'}
          </button>
        </div>
      </div>
    </div>
  )
}
