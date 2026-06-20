import { useEffect, useState, useSyncExternalStore } from 'react'
import { FolderOpen, KeyRound, Network, Terminal, Type, X } from 'lucide-react'
import {
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  getFont,
  getFontSize,
  setFont,
  setFontSize,
  subscribeFont,
  subscribeFontSize,
  type AppFont,
  type AppFontSize,
} from '@/font'

type Presence = { openrouter: boolean; openai: boolean; anthropic: boolean }

const PROVIDERS: { key: keyof Presence; label: string; hint: string }[] = [
  { key: 'openrouter', label: 'OpenRouter', hint: 'openrouter.ai/keys — unlocks OpenRouter agent + chat (400+ models)' },
  { key: 'anthropic', label: 'Anthropic', hint: 'unlocks the Anthropic Harness provider (run forge/temper with no CLI)' },
  { key: 'openai', label: 'OpenAI', hint: 'for a future OpenAI-direct provider (not yet wired)' },
]

export function Settings({ onClose }: { onClose: () => void }) {
  const [presence, setPresence] = useState<Presence>({ openrouter: false, openai: false, anthropic: false })
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [workspaceDir, setWorkspaceDir] = useState('')
  const [defaultDir, setDefaultDir] = useState('')
  const [folderInput, setFolderInput] = useState('')
  const [savingFolder, setSavingFolder] = useState(false)
  const [folderError, setFolderError] = useState('')
  const [cli, setCli] = useState<{ codex: string; claude: string }>({ codex: '', claude: '' })
  const [savingCli, setSavingCli] = useState(false)
  const font = useSyncExternalStore(subscribeFont, getFont)
  const fontSize = useSyncExternalStore(subscribeFontSize, getFontSize)
  const [graphAware, setGraphAware] = useState(true)
  const [graphTemplate, setGraphTemplate] = useState('')
  const [defaultGraphTemplate, setDefaultGraphTemplate] = useState('')
  const [savingGraph, setSavingGraph] = useState(false)
  const [graphSaved, setGraphSaved] = useState(false)
  const [browse, setBrowse] = useState<{ path: string; parent: string | null; dirs: { name: string; path: string }[] } | null>(
    null,
  )

  const openBrowse = async (p?: string) => {
    try {
      const r = await fetch(`/api/fs/browse${p ? `?path=${encodeURIComponent(p)}` : ''}`)
      const d = await r.json()
      if (d.path) setBrowse({ path: d.path, parent: d.parent ?? null, dirs: d.dirs ?? [] })
    } catch {
      /* ignore */
    }
  }

  const createFolder = async () => {
    if (!browse) return
    const name = window.prompt('New folder name (created inside the current folder):')?.trim()
    if (!name) return
    try {
      const r = await fetch(`/api/fs/mkdir?path=${encodeURIComponent(`${browse.path}/${name}`)}`, { method: 'POST' })
      const d = await r.json()
      if (d.ok) openBrowse(browse.path)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        setPresence(d.keys)
        setWorkspaceDir(d.workspaceDir ?? '')
        setDefaultDir(d.defaultWorkspaceDir ?? '')
        setFolderInput(d.workspaceDir ?? '')
        setCli({ codex: d.cli?.codex ?? '', claude: d.cli?.claude ?? '' })
        setGraphAware(d.graphAware !== false)
        setGraphTemplate(d.graphTemplate ?? '')
        setDefaultGraphTemplate(d.defaultGraphTemplate ?? '')
      })
      .catch(() => {})
  }, [])

  const saveGraph = async (next?: { aware?: boolean; template?: string }) => {
    setSavingGraph(true)
    try {
      const r = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graphAware: next?.aware ?? graphAware,
          graphTemplate: next?.template ?? graphTemplate,
        }),
      })
      const d = await r.json()
      setGraphAware(d.graphAware !== false)
      setGraphTemplate(d.graphTemplate ?? '')
      setGraphSaved(true)
      setTimeout(() => setGraphSaved(false), 1500)
    } catch {
      /* ignore */
    }
    setSavingGraph(false)
  }

  const saveCli = async () => {
    setSavingCli(true)
    try {
      const r = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cli }),
      })
      const d = await r.json()
      setCli({ codex: d.cli?.codex ?? '', claude: d.cli?.claude ?? '' })
      window.dispatchEvent(new Event('ft:providers-changed'))
    } catch {
      /* ignore */
    }
    setSavingCli(false)
  }

  const save = async () => {
    setSaving(true)
    const body = Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim()))
    const r = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await r.json()
    setPresence(d.keys)
    setValues({})
    setSaving(false)
    // Tell the Inspector to re-check provider availability (so a freshly-added
    // key, e.g. OpenRouter, shows up in the node Provider dropdown immediately).
    window.dispatchEvent(new Event('ft:providers-changed'))
  }

  const saveFolder = async (dirArg?: string) => {
    const dir = (dirArg ?? folderInput).trim()
    if (!dir) {
      setFolderError('Enter an absolute path.')
      return
    }
    setSavingFolder(true)
    setFolderError('')
    try {
      const r = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceDir: dir }),
      })
      const d = await r.json()
      if (!d.ok) {
        setFolderError(d.error ?? 'Failed to save project folder.')
      } else {
        setWorkspaceDir(d.workspaceDir ?? dir)
        setFolderInput(d.workspaceDir ?? dir)
        setBrowse(null)
      }
    } catch (e) {
      setFolderError(String(e))
    }
    setSavingFolder(false)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-[28rem] flex-col rounded-xl border border-border/15 bg-card text-fg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border/10 px-4 py-3">
          <KeyRound className="size-4 text-amber-300" />
          <h2 className="text-sm font-semibold text-fg/90">Settings</h2>
          <button onClick={onClose} className="ml-auto rounded p-1 text-fg/40 hover:bg-fg/10">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">{/* scroll body */}

        <div className="mb-4 space-y-2 rounded-lg border border-border/15 bg-fg/[0.03] p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-fg/80">
            <Type className="size-4 text-temper" />
            Appearance
          </div>
          <label className="block text-[11px] text-fg/55">App font</label>
          <select
            value={font}
            onChange={(e) => setFont(e.target.value as AppFont)}
            className="w-full rounded-md border border-border/15 bg-card px-2 py-1 text-xs text-fg/90 outline-none focus:border-temper"
          >
            {FONT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-card">
                {o.label}
              </option>
            ))}
          </select>
          <label className="block pt-1 text-[11px] text-fg/55">Text size</label>
          <select
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value as AppFontSize)}
            className="w-full rounded-md border border-border/15 bg-card px-2 py-1 text-xs text-fg/90 outline-none focus:border-temper"
          >
            {FONT_SIZE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-card">
                {o.label}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-fg/30">Applies instantly, saved in your browser. Toggle light/dark with the ☀/🌙 in the header.</p>
        </div>

        <div className="mb-4 space-y-2 rounded-lg border border-border/15 bg-fg/[0.03] p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-fg/80">
            <FolderOpen className="size-4 text-emerald-300" />
            Project folder
          </div>
          <p className="text-[11px] text-fg/40">
            The root where <code className="text-fg/60">library/</code>, <code className="text-fg/60">papers/</code> and{' '}
            <code className="text-fg/60">warehouse/</code> are created. Absolute path; persists across restarts.
          </p>
          <div className="flex gap-1">
            <input
              type="text"
              placeholder={defaultDir || '/absolute/path/to/project'}
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              spellCheck={false}
              className="min-w-0 flex-1 rounded-md border border-border/15 bg-card px-2 py-1 font-mono text-xs text-fg/90 outline-none focus:border-temper"
            />
            <button
              onClick={() => (browse ? setBrowse(null) : openBrowse(workspaceDir || undefined))}
              className="shrink-0 rounded-md border border-border/15 bg-fg/5 px-2 py-1 text-xs text-fg/70 hover:bg-fg/10"
            >
              {browse ? 'Close' : 'Browse…'}
            </button>
            <button
              onClick={() => saveFolder()}
              disabled={savingFolder}
              title="Make this path the active project root (creates library/, papers/, warehouse/ there)"
              className="shrink-0 rounded-md bg-emerald-500/20 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
            >
              {savingFolder ? '…' : 'Set'}
            </button>
          </div>
          {folderError && <p className="text-[10px] text-rose-400">{folderError}</p>}

          {browse && (
            <div className="rounded-md border border-border/15 bg-card p-2">
              <div className="mb-1 flex items-center gap-1 text-[10px] text-fg/45">
                <button
                  disabled={!browse.parent}
                  onClick={() => browse.parent && openBrowse(browse.parent)}
                  className="rounded px-1 py-0.5 hover:bg-fg/10 disabled:opacity-30"
                >
                  ⬆ up
                </button>
                <span className="min-w-0 flex-1 truncate font-mono">{browse.path}</span>
                <button
                  onClick={createFolder}
                  className="shrink-0 rounded px-1 py-0.5 text-emerald-300 hover:bg-fg/10"
                  title="Create a new folder here"
                >
                  + New folder
                </button>
              </div>
              <div className="max-h-40 overflow-auto">
                {browse.dirs.length === 0 && <p className="px-1 py-1 text-[10px] text-fg/30">(no subfolders)</p>}
                {browse.dirs.map((d) => (
                  <button
                    key={d.path}
                    onClick={() => openBrowse(d.path)}
                    className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[11px] text-fg/75 hover:bg-fg/10"
                  >
                    <FolderOpen className="size-3.5 shrink-0 text-amber-300/80" />
                    <span className="truncate">{d.name}</span>
                  </button>
                ))}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 border-t border-border/10 pt-1">
                <span className="min-w-0 truncate text-[10px] text-fg/40">
                  Use: <code className="text-fg/60">{browse.path}</code>
                </span>
                <button
                  onClick={() => saveFolder(browse.path)}
                  disabled={savingFolder}
                  className="shrink-0 rounded-md bg-emerald-500/20 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
                >
                  ✓ Use this folder
                </button>
              </div>
            </div>
          )}

          <p className="text-[10px] text-fg/30">
            Browse to a folder and “Use this folder”, or type a path + “Set” (saves it as the active project root — that’s
            all “Set” does; nothing is moved). Current: <code className="text-fg/60">{workspaceDir || '—'}</code>
            {defaultDir && (
              <>
                {' '}
                · Default: <code className="text-fg/50">{defaultDir}</code>
              </>
            )}
            . Existing data stays under the previous root.
          </p>
        </div>

        <div className="mb-4 space-y-2 rounded-lg border border-border/15 bg-fg/[0.03] p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-fg/80">
            <Terminal className="size-4 text-sky-300" />
            CLI paths
          </div>
          <p className="text-[11px] text-fg/40">
            Auto-detected by default (Claude Code on PATH; Codex from the IDE extension). Override only if yours live
            elsewhere.
          </p>
          {(['codex', 'claude'] as const).map((name) => (
            <div key={name} className="space-y-1">
              <label className="block text-[11px] capitalize text-fg/55">{name} CLI path</label>
              <input
                type="text"
                spellCheck={false}
                placeholder="auto-detected"
                value={cli[name]}
                onChange={(e) => setCli((c) => ({ ...c, [name]: e.target.value }))}
                className="w-full rounded-md border border-border/15 bg-card px-2 py-1 font-mono text-xs text-fg/90 outline-none focus:border-temper"
              />
            </div>
          ))}
          <div className="flex justify-end">
            <button
              onClick={saveCli}
              disabled={savingCli}
              className="rounded-md bg-sky-500/20 px-3 py-1 text-xs text-sky-300 hover:bg-sky-500/30 disabled:opacity-50"
            >
              {savingCli ? 'Saving…' : 'Save CLI paths'}
            </button>
          </div>
        </div>

        <div className="mb-4 space-y-2 rounded-lg border border-border/15 bg-fg/[0.03] p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-fg/80">
            <Network className="size-4 text-temper" />
            Agent self-awareness
          </div>
          <p className="text-[11px] text-fg/40">
            Before each agent runs, Forge prepends an auto-generated map of where the node sits in the graph (what it
            consumes, what it feeds, the loops) to its system prompt — so it knows its role. Edit the wrapper below;{' '}
            <code className="text-fg/60">{'{{graph}}'}</code> is replaced by the live map at run time.
          </p>
          <label className="flex items-center gap-2 text-[11px] text-fg/70">
            <input
              type="checkbox"
              checked={graphAware}
              onChange={(e) => {
                setGraphAware(e.target.checked)
                void saveGraph({ aware: e.target.checked })
              }}
            />
            Inject graph context into every agent
          </label>
          <textarea
            value={graphTemplate}
            onChange={(e) => setGraphTemplate(e.target.value)}
            disabled={!graphAware}
            rows={8}
            spellCheck={false}
            className="w-full rounded-md border border-border/15 bg-card px-2 py-1 font-mono text-[11px] leading-relaxed text-fg/90 outline-none focus:border-temper disabled:opacity-50"
          />
          <div className="flex items-center justify-end gap-2">
            {graphSaved && <span className="mr-auto text-[10px] text-emerald-300">saved</span>}
            <button
              onClick={() => {
                setGraphTemplate(defaultGraphTemplate)
                void saveGraph({ template: defaultGraphTemplate })
              }}
              className="rounded-md px-2 py-1 text-[11px] text-fg/50 hover:bg-fg/10"
            >
              Reset to default
            </button>
            <button
              onClick={() => void saveGraph()}
              disabled={savingGraph || !graphAware}
              className="rounded-md bg-temper/20 px-3 py-1 text-xs text-temper hover:bg-temper/30 disabled:opacity-50"
            >
              {savingGraph ? 'Saving…' : 'Save template'}
            </button>
          </div>
        </div>

        <h3 className="mb-2 text-xs font-medium text-fg/80">Provider API keys</h3>
        <p className="mb-3 text-[11px] text-fg/40">
          Keys are stored locally in <code className="text-fg/60">.forge-temper/settings.json</code> and never sent back
          to the browser.
        </p>
        <div className="space-y-3">
          {PROVIDERS.map((p) => (
            <div key={p.key} className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-fg/70">
                {p.label}
                {presence[p.key] ? (
                  <span className="rounded bg-emerald-500/20 px-1.5 text-[10px] text-emerald-300">configured</span>
                ) : (
                  <span className="rounded bg-fg/10 px-1.5 text-[10px] text-fg/40">not set</span>
                )}
              </div>
              <input
                type="password"
                placeholder={presence[p.key] ? '•••••• (saved — type to replace)' : `${p.label} API key`}
                value={values[p.key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [p.key]: e.target.value }))}
                className="w-full rounded-md border border-border/15 bg-card px-2 py-1 text-xs text-fg/90 outline-none focus:border-temper"
              />
              <p className="text-[10px] text-fg/25">{p.hint}</p>
            </div>
          ))}
        </div>
        </div>
        {/* end scroll body */}

        <div className="flex shrink-0 justify-end gap-2 border-t border-border/10 px-4 py-3">
          <button onClick={onClose} className="rounded-md px-3 py-1 text-xs text-fg/50 hover:bg-fg/10">
            Close
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-temper/20 px-3 py-1 text-xs text-temper hover:bg-temper/30 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save keys'}
          </button>
        </div>
      </div>
    </div>
  )
}
