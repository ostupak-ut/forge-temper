import { useEffect, useState } from 'react'
import { FolderOpen, KeyRound, X } from 'lucide-react'

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

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        setPresence(d.keys)
        setWorkspaceDir(d.workspaceDir ?? '')
        setDefaultDir(d.defaultWorkspaceDir ?? '')
        setFolderInput(d.workspaceDir ?? '')
      })
      .catch(() => {})
  }, [])

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
  }

  const saveFolder = async () => {
    const dir = folderInput.trim()
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
      }
    } catch (e) {
      setFolderError(String(e))
    }
    setSavingFolder(false)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60" onClick={onClose}>
      <div
        className="w-[28rem] rounded-xl border border-border/15 bg-surface p-4 text-fg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <KeyRound className="size-4 text-amber-300" />
          <h2 className="text-sm font-semibold text-fg/90">Settings</h2>
          <button onClick={onClose} className="ml-auto rounded p-1 text-fg/40 hover:bg-fg/10">
            <X className="size-4" />
          </button>
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
          <input
            type="text"
            placeholder={defaultDir || '/absolute/path/to/project'}
            value={folderInput}
            onChange={(e) => setFolderInput(e.target.value)}
            spellCheck={false}
            className="w-full rounded-md border border-border/15 bg-card px-2 py-1 text-xs text-fg/90 outline-none focus:border-temper"
          />
          {folderError && <p className="text-[10px] text-rose-400">{folderError}</p>}
          <p className="text-[10px] text-fg/30">
            Existing data stays under the previous root — move it manually if you want it in the new folder.
            {defaultDir && (
              <>
                {' '}
                Default: <code className="text-fg/50">{defaultDir}</code>.
              </>
            )}
          </p>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[10px] text-fg/40">
              Current: <code className="text-fg/60">{workspaceDir || '—'}</code>
            </span>
            <button
              onClick={saveFolder}
              disabled={savingFolder}
              className="shrink-0 rounded-md bg-emerald-500/20 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
            >
              {savingFolder ? 'Saving…' : 'Save folder'}
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
        <div className="mt-4 flex justify-end gap-2">
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
