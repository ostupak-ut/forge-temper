import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Archive,
  BookmarkPlus,
  ChevronRight,
  File as FileIcon,
  Folder,
  FolderPlus,
  PanelRightClose,
  Play,
  Plus,
  RefreshCw,
  Repeat,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { usePresets } from '@/io/customPresets'
import type { Edge } from '@xyflow/react'
import { useGraphStore } from '@/store/graphStore'
import { getSpec } from '@/registry/nodeSpecs'
import { AGENT_ICONS, ICON_NAMES, resolveNodeIcon } from '@/registry/icons'
import type { FieldDescriptor, FieldOption } from '@/registry/types'
import type { NodeRunStatus } from '@shared/contracts'
import { runSingleNode, stopCurrentRun } from '@/run/runController'
import { fetchModels, type ModelInfo } from '@/run/providerModels'
import { DiscBar } from '@/components/DiscBar'
import { MultiSelectField } from '@/components/MultiSelectField'
import { PromptEditor } from './PromptEditor'

const STATUS_PILL: Record<NodeRunStatus, string> = {
  idle: 'bg-fg/10 text-fg/50',
  queued: 'bg-amber-400/20 text-amber-300',
  running: 'bg-temper/20 text-temper',
  done: 'bg-emerald-400/20 text-emerald-300',
  error: 'bg-red-500/20 text-red-300',
  skipped: 'bg-fg/5 text-fg/30',
}

const inputCls =
  'w-full rounded-md border border-border/10 bg-field px-2 py-1 text-xs text-fg/90 outline-none focus:border-temper'

/** Path field with a "Choose file…" button (OS dialog → uploads into the workspace). */
function FilePathField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const r = await fetch(`/api/fs/upload?name=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
      })
      const d = await r.json()
      if (d.path) onChange(d.path)
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }
  return (
    <div className="flex gap-1">
      <input
        className={inputCls + ' font-mono'}
        value={value}
        placeholder={placeholder ?? 'choose a file, or type a path…'}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        onClick={() => ref.current?.click()}
        disabled={busy}
        title="Choose a file from your computer"
        className="flex shrink-0 items-center gap-1 rounded-md border border-border/10 bg-fg/5 px-2 text-xs text-fg/70 hover:bg-fg/10 disabled:opacity-50"
      >
        <Upload className="size-3" />
        {busy ? '…' : 'Choose'}
      </button>
      <input ref={ref} type="file" className="hidden" onChange={onFile} />
    </div>
  )
}

// Config-group order: the things that matter most (Prompt, Verification) sit at
// the top; the cosmetic "Design" (symbol/color) group sorts last and collapses.
const GROUP_PRIORITY: Record<string, number> = {
  Idea: 0,
  Card: 1,
  Prompt: 2,
  Verification: 3,
  Model: 4,
  Files: 5,
  Output: 6,
  Execution: 7,
  Warehouse: 8,
  Config: 9,
  Design: 10,
}

// Curated model suggestions for providers without a live model API (codex, the
// Anthropic harness). They seed the datalist so you can PICK a model — or type
// any other the CLI/API accepts. OpenRouter fetches its list live instead.
const SUGGESTED_MODELS: Record<string, { id: string; name: string }[]> = {
  codex: [
    { id: 'gpt-5.5', name: 'GPT-5.5' },
    { id: 'gpt-5.4', name: 'GPT-5.4' },
    { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini' },
    { id: 'gpt-5.3-codex-spark', name: 'GPT-5.3 Codex Spark' },
  ],
  'anthropic-harness': [
    { id: 'claude-opus-4-8', name: 'Opus 4.8' },
    { id: 'claude-sonnet-4-6', name: 'Sonnet 4.6' },
    { id: 'claude-haiku-4-5', name: 'Haiku 4.5' },
  ],
}

/** Model picker — a single-click <select> for every provider (no double-click). */
function ModelField({
  provider,
  options,
  value,
  onChange,
}: {
  provider: string
  options: FieldOption[]
  value: string
  onChange: (v: string) => void
}) {
  const [models, setModels] = useState<ModelInfo[]>([])
  useEffect(() => {
    // Only OpenRouter has a live model API; codex/harness use curated lists.
    if (provider !== 'claude-code' && !SUGGESTED_MODELS[provider]) fetchModels(provider).then(setModels)
  }, [provider])

  // claude-code uses its passed MODEL_OPTIONS; others = Inherit + curated/fetched.
  let opts: FieldOption[]
  if (provider === 'claude-code') {
    opts = options
  } else {
    const curated = SUGGESTED_MODELS[provider] ?? []
    const merged = [...curated, ...models.filter((m) => !curated.some((c) => c.id === m.id))]
    opts = [{ value: 'inherit', label: 'Inherit (default)' }, ...merged.map((m) => ({ value: m.id, label: m.name }))]
  }
  const cur = String(value ?? 'inherit') || 'inherit'
  // Only OpenRouter takes arbitrary model ids — keep an off-list value selectable
  // there. For Claude/Codex/harness a foreign model (e.g. a Grok id left over from
  // OpenRouter) is invalid, so the list falls back to "inherit".
  const freeform = provider === 'openrouter' || provider === 'openrouter-agent'
  if (cur !== 'inherit' && freeform && !opts.some((o) => o.value === cur)) {
    opts = [...opts, { value: cur, label: `${cur} (custom)` }]
  }
  const shown = opts.some((o) => o.value === cur) ? cur : 'inherit'

  return (
    <select className={inputCls} value={shown} onChange={(e) => onChange(e.target.value)}>
      {opts.map((o) => (
        <option key={o.value} value={o.value} className="bg-card">
          {o.label}
        </option>
      ))}
    </select>
  )
}

/** Skill picker — a dropdown of available skills (~/.claude/skills first, then bundled). */
function SkillField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [skills, setSkills] = useState<string[]>([])
  useEffect(() => {
    fetch('/api/skills')
      .then((r) => r.json())
      .then((d) => setSkills((d.skills ?? []) as string[]))
      .catch(() => setSkills([]))
  }, [])
  // Keep a previously-set skill visible even if it isn't currently on disk.
  const opts = value && !skills.includes(value) ? [value, ...skills] : skills
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="" className="bg-card">
        — none —
      </option>
      {opts.map((s) => (
        <option key={s} value={s} className="bg-card">
          {s}
        </option>
      ))}
    </select>
  )
}

/** Grid of selectable symbols for a Custom Agent node. */
function IconField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-1">
      {ICON_NAMES.map((name) => {
        const I = AGENT_ICONS[name]
        const active = value === name
        return (
          <button
            key={name}
            type="button"
            title={name}
            onClick={() => onChange(name)}
            className={
              'grid aspect-square place-items-center rounded-md border transition ' +
              (active
                ? 'border-temper bg-temper/15 text-temper'
                : 'border-border/10 bg-fg/5 text-fg/55 hover:bg-fg/10 hover:text-fg/80')
            }
          >
            <I className="size-4" />
          </button>
        )
      })}
    </div>
  )
}

/** Shows a run's produced artifacts inline: the compiled PDF + links to .md/.tex. */
function NodeOutput({ protoDir }: { protoDir: string }) {
  const [files, setFiles] = useState<{ name: string; rel: string }[]>([])
  useEffect(() => {
    fetch(`/api/fs/list?path=${encodeURIComponent(protoDir)}`)
      .then((r) => r.json())
      .then((d) =>
        setFiles(((d.items ?? []) as { name: string; rel: string; dir: boolean }[]).filter((f) => !f.dir)),
      )
      .catch(() => setFiles([]))
  }, [protoDir])

  const pdf = files.find((f) => f.name.toLowerCase().endsWith('.pdf'))
  const docs = files.filter((f) => f.name.endsWith('.md') || f.name.endsWith('.tex'))
  const raw = (rel: string) => `/api/fs/raw?path=${encodeURIComponent(rel)}`

  if (files.length === 0) return null
  return (
    <div className="mt-1.5 border-t border-border/10 pt-1.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-fg/30">Output</span>
        {pdf && (
          <a href={raw(pdf.rel)} target="_blank" rel="noreferrer" className="text-[10px] text-temper hover:underline">
            open full ↗
          </a>
        )}
      </div>
      {pdf && (
        <iframe title="paper" src={raw(pdf.rel)} className="h-72 w-full rounded border border-border/10 bg-white" />
      )}
      {docs.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {docs.map((f) => (
            <a
              key={f.rel}
              href={raw(f.rel)}
              target="_blank"
              rel="noreferrer"
              className="rounded bg-fg/5 px-1.5 py-0.5 text-[10px] text-fg/55 hover:bg-fg/10"
            >
              {f.name}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

/** Config panel for a selected edge. The Temper→Forge feedback arrow IS the loop. */
function EdgeInspector({
  edge,
  updateEdgeData,
  onDelete,
  onClose,
}: {
  edge: Edge
  updateEdgeData: (id: string, patch: Record<string, unknown>) => void
  onDelete: () => void
  onClose?: () => void
}) {
  const isLoop = edge.type === 'feedback' || Boolean((edge.data as { loopBackEdge?: unknown })?.loopBackEdge)
  const data = (edge.data ?? {}) as { mode?: string; maxIterations?: number }
  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-border/10 bg-surface">
      <div className="flex items-center gap-2 border-b border-border/10 px-3 py-2">
        <Repeat className="size-4 text-rose-400" />
        <span className="flex-1 text-sm font-medium text-fg/90">{isLoop ? 'Loop' : 'Connection'}</span>
        <button
          onClick={onDelete}
          title={isLoop ? 'Remove the loop (delete this arrow)' : 'Delete this edge'}
          className="rounded p-1 text-fg/40 hover:bg-red-500/20 hover:text-red-300"
        >
          <Trash2 className="size-4" />
        </button>
        {onClose && (
          <button onClick={onClose} title="Close panel" className="rounded p-1 text-fg/40 hover:bg-fg/10 hover:text-fg/80">
            <PanelRightClose className="size-4" />
          </button>
        )}
      </div>
      <div className="flex-1 space-y-4 overflow-auto p-3">
        {isLoop ? (
          <>
            <p className="text-[11px] leading-tight text-fg/35">
              This arrow is the loop: Temper’s verdict flows back into Forge each iteration until all results are
              correct or the cap is hit.
            </p>
            <div className="space-y-1">
              <label className="block text-[11px] text-fg/55">Mode</label>
              <select
                className={inputCls}
                value={data.mode ?? 'until-pass'}
                onChange={(e) => updateEdgeData(edge.id, { mode: e.target.value })}
              >
                <option value="until-pass" className="bg-card">
                  Until pass (smart: temper all-correct)
                </option>
                <option value="until-count" className="bg-card">
                  Until count (fixed iterations)
                </option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] text-fg/55">Max iterations</label>
              <input
                type="number"
                className={inputCls}
                min={1}
                max={20}
                step={1}
                value={Number(data.maxIterations ?? 3)}
                onChange={(e) => updateEdgeData(edge.id, { maxIterations: e.target.value === '' ? '' : Number(e.target.value) })}
              />
              <p className="text-[10px] leading-tight text-fg/25">Always a hard cap, even in smart mode.</p>
            </div>
          </>
        ) : (
          <p className="text-[11px] leading-tight text-fg/35">
            A data connection — it carries the source node’s output into this input. (Click the dashed rose loop arrow for loop settings.)
          </p>
        )}
      </div>
    </div>
  )
}

const COLOR_SWATCHES = [
  '#22d3ee', '#0ea5e9', '#8b5cf6', '#a855f7', '#e8743b', '#f97316',
  '#22c55e', '#14b8a6', '#eab308', '#f43f5e', '#ec4899', '#94a3b8',
]

/** Accent-color picker for a Custom Agent node: preset swatches + a native picker. */
function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {COLOR_SWATCHES.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          title={c}
          className={'size-5 rounded-full border transition ' + (value === c ? 'border-fg ring-2 ring-border/40' : 'border-border/20 hover:border-border/50')}
          style={{ background: c }}
        />
      ))}
      <input
        type="color"
        value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#22d3ee'}
        onChange={(e) => onChange(e.target.value)}
        title="Custom color"
        className="ml-1 size-6 cursor-pointer rounded border border-border/20 bg-transparent"
      />
    </div>
  )
}

interface FsLite {
  name: string
  dir: boolean
  rel: string
}

/** Browse the workspace Library and add files/folders to a Files node. */
function LibraryPicker({ onAdd, onClose }: { onAdd: (p: string) => void; onClose: () => void }) {
  const [dir, setDir] = useState('library')
  const [items, setItems] = useState<FsLite[]>([])
  useEffect(() => {
    fetch(`/api/fs/list?path=${encodeURIComponent(dir)}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]))
  }, [dir])
  const crumbs = dir.split('/').filter(Boolean)
  return (
    <div className="mt-1 rounded-md border border-border/10 bg-field p-2">
      <div className="mb-1 flex items-center gap-1 text-[10px] text-fg/45">
        {crumbs.map((c, i) => (
          <button key={i} className="hover:text-fg/80" onClick={() => setDir(crumbs.slice(0, i + 1).join('/'))}>
            {i > 0 ? '/ ' : ''}
            {c}
          </button>
        ))}
        <button
          className="ml-auto rounded bg-fg/10 px-1.5 py-0.5 hover:bg-fg/20"
          title="Add this whole folder"
          onClick={() => onAdd(dir)}
        >
          + this folder
        </button>
        <button className="rounded p-0.5 hover:bg-fg/10" onClick={onClose} title="Close">
          <X className="size-3" />
        </button>
      </div>
      <div className="max-h-40 overflow-auto">
        {items.length === 0 && <p className="px-1 py-2 text-[10px] text-fg/30">empty — upload below</p>}
        {items.map((it) => (
          <div key={it.rel} className="flex items-center gap-2 rounded px-1.5 py-1 text-[11px] text-fg/70 hover:bg-fg/5">
            {it.dir ? <Folder className="size-3.5 shrink-0 text-amber-300/80" /> : <FileIcon className="size-3.5 shrink-0 text-fg/40" />}
            <button className="min-w-0 flex-1 truncate text-left" onClick={() => (it.dir ? setDir(it.rel) : onAdd(it.rel))}>
              {it.name}
            </button>
            <button
              className="rounded bg-fg/5 px-1.5 py-0.5 text-[10px] hover:bg-fg/10"
              onClick={() => onAdd(it.rel)}
            >
              add
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Multi-entry file/folder picker for the Files node: upload or pick from the Library. */
function FilesField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const filesRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const [pick, setPick] = useState(false)
  const [busy, setBusy] = useState(false)

  const add = (p: string) => {
    if (p && !value.includes(p)) onChange([...value, p])
  }
  const remove = (p: string) => onChange(value.filter((x) => x !== p))

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    const added: string[] = []
    for (const f of Array.from(files)) {
      const relName = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name
      try {
        const r = await fetch(`/api/fs/upload?path=${encodeURIComponent('library/' + relName)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: f,
        })
        const d = await r.json()
        if (d.path) {
          const top = relName.includes('/') ? 'library/' + relName.split('/')[0] : d.path
          if (!added.includes(top)) added.push(top)
        }
      } catch {
        /* skip */
      }
    }
    setBusy(false)
    const next = [...value]
    for (const a of added) if (!next.includes(a)) next.push(a)
    onChange(next)
    if (filesRef.current) filesRef.current.value = ''
    if (folderRef.current) folderRef.current.value = ''
  }

  return (
    <div className="space-y-1.5">
      {value.length > 0 && (
        <div className="space-y-1">
          {value.map((p) => {
            const isFolder = !/\.[a-z0-9]+$/i.test(p)
            return (
              <div
                key={p}
                className="flex items-center gap-2 rounded-md border border-border/10 bg-field px-2 py-1 text-[11px] text-fg/75"
              >
                {isFolder ? (
                  <Folder className="size-3.5 shrink-0 text-amber-300/80" />
                ) : (
                  <FileIcon className="size-3.5 shrink-0 text-fg/40" />
                )}
                <span className="min-w-0 flex-1 truncate font-mono">{p.replace(/^library\//, '')}</span>
                <button
                  className="rounded p-0.5 text-fg/30 hover:bg-red-500/20 hover:text-red-300"
                  onClick={() => remove(p)}
                  title="Remove"
                >
                  <X className="size-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        <button
          className="flex items-center gap-1 rounded-md border border-border/10 bg-fg/5 px-2 py-1 text-[11px] text-fg/70 hover:bg-fg/10 disabled:opacity-50"
          onClick={() => filesRef.current?.click()}
          disabled={busy}
        >
          <Upload className="size-3" /> {busy ? '…' : 'Upload files'}
        </button>
        <button
          className="flex items-center gap-1 rounded-md border border-border/10 bg-fg/5 px-2 py-1 text-[11px] text-fg/70 hover:bg-fg/10 disabled:opacity-50"
          onClick={() => folderRef.current?.click()}
          disabled={busy}
        >
          <FolderPlus className="size-3" /> Upload folder
        </button>
        <button
          className="flex items-center gap-1 rounded-md border border-border/10 bg-fg/5 px-2 py-1 text-[11px] text-fg/70 hover:bg-fg/10"
          onClick={() => setPick((p) => !p)}
        >
          <Plus className="size-3" /> Library
        </button>
      </div>
      {pick && <LibraryPicker onAdd={add} onClose={() => setPick(false)} />}
      <input ref={filesRef} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
      <input
        ref={folderRef}
        type="file"
        className="hidden"
        onChange={(e) => upload(e.target.files)}
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
      />
    </div>
  )
}

/** Gallery of a Warehouse node's accumulated runs (newest first), each expandable to its files. */
function WarehouseGallery({ nodeId }: { nodeId: string }) {
  const whName = useGraphStore((s) => {
    const nm = s.nodes.find((x) => x.id === nodeId)?.data.config?.warehouseName
    return (typeof nm === 'string' && nm.trim()) || nodeId
  })
  const updateNodeConfig = useGraphStore((s) => s.updateNodeConfig)
  const runStatus = useGraphStore((s) => s.runState[nodeId]?.status)
  const base = `warehouse/${whName}`
  const [runs, setRuns] = useState<FsLite[]>([])
  const [openRun, setOpenRun] = useState<string | null>(null)
  const [files, setFiles] = useState<FsLite[]>([])
  const [loading, setLoading] = useState(false)
  const [existing, setExisting] = useState<string[]>([])

  const reload = useCallback(() => {
    setLoading(true)
    return fetch(`/api/fs/list?path=${encodeURIComponent(base)}`)
      .then((r) => r.json())
      .then((d) => setRuns(((d.items ?? []) as FsLite[]).filter((i) => i.dir).sort((a, b) => b.name.localeCompare(a.name))))
      .catch(() => setRuns([]))
      .finally(() => setLoading(false))
  }, [base])

  const loadExisting = useCallback(() => {
    fetch('/api/fs/list?path=warehouse')
      .then((r) => r.json())
      .then((d) => setExisting(((d.items ?? []) as FsLite[]).filter((i) => i.dir).map((i) => i.name)))
      .catch(() => setExisting([]))
  }, [])

  useEffect(() => {
    setOpenRun(null)
    void reload()
    loadExisting()
  }, [reload, loadExisting])

  // Auto-refresh the pile the moment this warehouse finishes archiving a run.
  useEffect(() => {
    if (runStatus === 'done') {
      void reload()
      loadExisting()
    }
  }, [runStatus, reload, loadExisting])

  useEffect(() => {
    if (!openRun) {
      setFiles([])
      return
    }
    fetch(`/api/fs/list?path=${encodeURIComponent(openRun)}`)
      .then((r) => r.json())
      .then((d) => setFiles(((d.items ?? []) as FsLite[]).filter((i) => !i.dir)))
      .catch(() => setFiles([]))
  }, [openRun])

  const clearPile = async () => {
    if (!window.confirm(`Clear warehouse "${whName}"? This deletes all piled runs from disk.`)) return
    setLoading(true)
    await fetch(`/api/fs/delete?path=${encodeURIComponent(base)}`, { method: 'DELETE' }).catch(() => {})
    setOpenRun(null)
    await reload()
    loadExisting()
  }

  const adoptable = existing.filter((n) => n !== whName)
  const raw = (rel: string) => `/api/fs/raw?path=${encodeURIComponent(rel)}`
  return (
    <div className="space-y-1.5">
      {adoptable.length > 0 && (
        <select
          className={inputCls}
          value=""
          onChange={(e) => e.target.value && updateNodeConfig(nodeId, 'warehouseName', e.target.value)}
          title="Re-attach this node to an existing warehouse pile (restore it)"
        >
          <option value="">adopt an existing warehouse…</option>
          {adoptable.map((n) => (
            <option key={n} value={n} className="bg-card">
              {n}
            </option>
          ))}
        </select>
      )}
      <div className="flex items-center gap-2 text-[10px] text-fg/45">
        <span className="min-w-0 truncate">
          {runs.length} run{runs.length === 1 ? '' : 's'} · <span className="font-mono text-fg/55">{whName}</span>
        </span>
        <button
          onClick={() => void reload()}
          disabled={loading}
          className="ml-auto rounded p-0.5 hover:bg-fg/10 disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={'size-3 ' + (loading ? 'animate-spin' : '')} />
        </button>
        {runs.length > 0 && (
          <button
            onClick={clearPile}
            className="rounded p-0.5 text-fg/30 hover:bg-red-500/20 hover:text-red-300"
            title="Clear this warehouse (delete its runs from disk)"
          >
            <Trash2 className="size-3" />
          </button>
        )}
      </div>
      {runs.length === 0 && !loading && (
        <p className="text-[10px] text-fg/30">No results yet — run the graph; each run adds a folder here.</p>
      )}
      <div className="space-y-1">
        {runs.map((r) => (
          <div key={r.rel} className="rounded-md border border-border/10 bg-field">
            <button
              className="flex w-full items-center gap-2 px-2 py-1 text-left text-[11px] text-fg/75 hover:bg-fg/5"
              onClick={() => setOpenRun(openRun === r.rel ? null : r.rel)}
            >
              <Archive className="size-3.5 shrink-0 text-sky-400" />
              <span className="min-w-0 flex-1 truncate">{r.name.replace(/^run-/, '#')}</span>
              <ChevronRight className={'size-3 shrink-0 transition ' + (openRun === r.rel ? 'rotate-90' : '')} />
            </button>
            {openRun === r.rel && (
              <div className="border-t border-border/10 p-1">
                {files.length === 0 && <p className="px-1 py-1 text-[10px] text-fg/30">empty</p>}
                {files.map((f) => (
                  <a
                    key={f.rel}
                    href={raw(f.rel)}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate rounded px-1.5 py-0.5 text-[10px] text-sky-300/80 hover:bg-fg/5 hover:underline"
                  >
                    {f.name}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function Inspector({ onClose }: { onClose?: () => void }) {
  const selectedId = useGraphStore((s) => s.selectedNodeId)
  const node = useGraphStore((s) => s.nodes.find((n) => n.id === s.selectedNodeId) ?? null)
  const run = useGraphStore((s) => (s.selectedNodeId ? s.runState[s.selectedNodeId] : undefined))
  const updateNodeConfig = useGraphStore((s) => s.updateNodeConfig)
  const updateNodeLabel = useGraphStore((s) => s.updateNodeLabel)
  const deleteNode = useGraphStore((s) => s.deleteNode)
  const selectedEdgeId = useGraphStore((s) => s.selectedEdgeId)
  const edge = useGraphStore((s) => s.edges.find((e) => e.id === s.selectedEdgeId) ?? null)
  const updateEdgeData = useGraphStore((s) => s.updateEdgeData)
  const setSelectedEdge = useGraphStore((s) => s.setSelectedEdge)
  const onEdgesChange = useGraphStore((s) => s.onEdgesChange)
  const [avail, setAvail] = useState<Record<string, boolean>>({})
  const [designOpen, setDesignOpen] = useState(false)
  useEffect(() => {
    const refresh = () =>
      fetch('/api/health')
        .then((r) => r.json())
        .then((d) => setAvail(d.providers ?? {}))
        .catch(() => {})
    refresh()
    // Re-check when Settings saves a key/CLI path (so a newly-added provider
    // appears in the dropdown without a reload), and when the tab regains focus.
    window.addEventListener('ft:providers-changed', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener('ft:providers-changed', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  if (!node || !selectedId) {
    if (edge && selectedEdgeId) {
      return (
        <EdgeInspector
          edge={edge}
          updateEdgeData={updateEdgeData}
          onClose={onClose}
          onDelete={() => {
            onEdgesChange([{ id: edge.id, type: 'remove' }])
            setSelectedEdge(null)
          }}
        />
      )
    }
    return (
      <div className="relative flex h-full w-80 shrink-0 items-center justify-center border-l border-border/10 bg-surface p-4 text-center text-xs text-fg/30">
        {onClose && (
          <button
            onClick={onClose}
            title="Close panel"
            className="absolute right-2 top-2 rounded p-1 text-fg/40 hover:bg-fg/10 hover:text-fg/80"
          >
            <PanelRightClose className="size-4" />
          </button>
        )}
        Select a node — or the loop arrow — to edit its config.
      </div>
    )
  }

  const spec = getSpec(node.data.kind)
  const cfg = node.data.config
  const Icon = resolveNodeIcon(cfg.symbol, spec.icon)
  const accent = typeof cfg.color === 'string' && cfg.color ? cfg.color : spec.color
  const variables = spec.inputs.map((p) => p.id)
  // "Design" (symbol + color) lives in a popover off the avatar, not the panel.
  const designFields = spec.fields.filter((f) => f.group === 'Design')

  const groups = new Map<string, FieldDescriptor[]>()
  for (const f of spec.fields) {
    const g = f.group ?? 'Config'
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(f)
  }

  const renderField = (f: FieldDescriptor) => {
    const value = cfg[f.key]
    const set = (v: unknown) => updateNodeConfig(selectedId, f.key, v)

    switch (f.kind) {
      case 'prompt':
        return (
          <PromptEditor
            nodeId={selectedId}
            value={String(value ?? '')}
            variables={variables}
            onChange={set}
          />
        )
      case 'textarea':
        return (
          <textarea
            className={inputCls + ' font-mono'}
            rows={f.rows ?? 3}
            value={String(value ?? '')}
            placeholder={f.placeholder}
            onChange={(e) => set(e.target.value)}
          />
        )
      case 'number':
        return (
          <input
            type="number"
            className={inputCls}
            value={Number(value ?? 0)}
            min={f.min}
            max={f.max}
            step={f.step}
            onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))}
          />
        )
      case 'boolean':
        return (
          <label className="flex items-center gap-2 text-xs text-fg/70">
            <input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} />
            {f.help ?? 'enabled'}
          </label>
        )
      case 'model':
        return (
          <ModelField
            provider={String(cfg.provider ?? 'claude-code')}
            options={f.options ?? []}
            value={String(value ?? '')}
            onChange={set}
          />
        )
      case 'select': {
        // The provider list shows only providers that are actually available
        // (CLI detected / API key set), plus whatever this node already uses.
        const opts =
          f.key === 'provider' && Object.keys(avail).length
            ? (f.options ?? []).filter((o) => avail[o.value] || o.value === String(value ?? ''))
            : (f.options ?? [])
        return (
          <select
            className={inputCls}
            value={String(value ?? '')}
            onChange={(e) => {
              set(e.target.value)
              // Switching provider invalidates the model (e.g. an OpenRouter model
              // under Claude Code) — reset it to the provider's default.
              if (f.key === 'provider') updateNodeConfig(selectedId, 'model', 'inherit')
            }}
          >
            {opts.map((o) => (
              <option key={o.value} value={o.value} className="bg-card">
                {o.label}
              </option>
            ))}
          </select>
        )
      }
      case 'skill':
        return <SkillField value={String(value ?? '')} onChange={set} />
      case 'multiselect':
        return (
          <MultiSelectField
            value={Array.isArray(value) ? (value as string[]) : []}
            options={f.options ?? []}
            onChange={set}
          />
        )
      case 'icon':
        return <IconField value={String(value ?? 'Sparkles')} onChange={set} />
      case 'color':
        return <ColorField value={String(value ?? '#22d3ee')} onChange={set} />
      case 'files':
        return <FilesField value={Array.isArray(value) ? (value as string[]) : []} onChange={set} />
      case 'warehouse':
        return <WarehouseGallery nodeId={selectedId} />
      case 'path':
        return f.pickFile ? (
          <FilePathField value={String(value ?? '')} onChange={set} placeholder={f.placeholder} />
        ) : (
          <input
            className={inputCls + ' font-mono'}
            value={String(value ?? '')}
            placeholder={f.placeholder ?? 'path…'}
            onChange={(e) => set(e.target.value)}
          />
        )
      default:
        return (
          <input
            className={inputCls}
            value={String(value ?? '')}
            placeholder={f.placeholder}
            onChange={(e) => set(e.target.value)}
          />
        )
    }
  }

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-border/10 bg-surface">
      <div className="relative flex items-center gap-1.5 border-b border-border/10 px-3 py-2">
        {designFields.length > 0 ? (
          <button
            type="button"
            onClick={() => setDesignOpen((o) => !o)}
            title="Customize symbol & color"
            className="shrink-0 rounded-md p-0.5 ring-1 ring-transparent transition hover:bg-fg/5 hover:ring-border/30"
          >
            <Icon className="size-4" style={{ color: accent }} />
          </button>
        ) : (
          <Icon className="size-4 shrink-0" style={{ color: accent }} />
        )}
        <input
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-fg/90 outline-none"
          value={node.data.label}
          onChange={(e) => updateNodeLabel(selectedId, e.target.value)}
        />
        {designOpen && designFields.length > 0 && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setDesignOpen(false)} />
            <div className="absolute left-2 top-12 z-20 w-64 space-y-3 rounded-lg border border-border/15 bg-card p-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-fg/40">Design</span>
                <button
                  onClick={() => setDesignOpen(false)}
                  title="Close"
                  className="rounded p-0.5 text-fg/40 hover:bg-fg/10"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              {designFields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <label className="block text-[11px] text-fg/55">{f.label}</label>
                  {renderField(f)}
                </div>
              ))}
            </div>
          </>
        )}
        {spec.fields.some((f) => f.kind === 'prompt') &&
          (run?.status === 'running' || run?.status === 'queued' ? (
            <button
              onClick={() => stopCurrentRun()}
              title="Stop run"
              className="rounded p-1 text-red-300 hover:bg-red-500/20"
            >
              <Square className="size-4" />
            </button>
          ) : (
            <button
              onClick={() => runSingleNode(selectedId)}
              title="Run this node (live Claude Code)"
              className="rounded p-1 text-emerald-300 hover:bg-emerald-500/20"
            >
              <Play className="size-4" />
            </button>
          ))}
        {node.data.kind === 'custom' && (
          <button
            onClick={() => {
              const name = window.prompt('Save this agent to the Palette as:', node.data.label)?.trim()
              if (!name) return
              usePresets.getState().add({
                name,
                symbol: typeof cfg.symbol === 'string' ? cfg.symbol : undefined,
                config: { ...node.data.config },
              })
            }}
            title="Save this agent to the Palette (reusable across graphs)"
            className="rounded p-1 text-sky-300 hover:bg-sky-500/20"
          >
            <BookmarkPlus className="size-4" />
          </button>
        )}
        <button
          onClick={() => deleteNode(selectedId)}
          title="Delete node"
          className="rounded p-1 text-fg/40 hover:bg-red-500/20 hover:text-red-300"
        >
          <Trash2 className="size-4" />
        </button>
        {onClose && (
          <button onClick={onClose} title="Close panel" className="rounded p-1 text-fg/40 hover:bg-fg/10 hover:text-fg/80">
            <PanelRightClose className="size-4" />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-3">
        <textarea
          className="w-full resize-none rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[11px] leading-tight text-fg/45 outline-none hover:border-border/15 focus:border-temper focus:bg-field"
          rows={2}
          value={String(cfg.description ?? '')}
          placeholder={spec.description}
          title="Description / note for this node (shows on the node and feeds its self-awareness)"
          onChange={(e) => updateNodeConfig(selectedId, 'description', e.target.value)}
        />

        {run && (
          <div className="rounded-lg border border-border/10 bg-field p-2 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-fg/60">Run</span>
              <span className={'rounded px-1.5 py-0.5 text-[10px] ' + STATUS_PILL[run.status]}>{run.status}</span>
              {run.costUsd != null && (
                <span
                  className="ml-auto text-fg/40"
                  title="API-rate estimate. On a Claude subscription this is not billed — it counts against your plan usage."
                >
                  ~${run.costUsd.toFixed(4)} est.
                </span>
              )}
            </div>
            {run.verdict && (
              <div className="mt-1.5 border-t border-border/10 pt-1.5">
                <DiscBar tally={run.verdict.distribution} allCorrect={run.verdict.allCorrect} />
                <p className="mt-0.5 text-[10px] text-fg/30">{run.verdict.results} results checked</p>
              </div>
            )}
            {run.error && <p className="mt-1 text-red-400">{run.error}</p>}
            {(run.result || run.tail) && (
              <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-snug text-fg/55">
                {run.result || run.tail}
              </pre>
            )}
          </div>
        )}
        {(node.data.kind === 'forge' || node.data.kind === 'temper') && (
          <NodeOutput
            protoDir={
              run?.verdict?.protoDir ??
              `${(typeof cfg.workingDir === 'string' && cfg.workingDir.trim()) || `papers/${selectedId}`}/proto`
            }
          />
        )}

        {[...groups.entries()]
          .filter(([group]) => group !== 'Design') // Design lives in the avatar popover
          .sort((a, b) => (GROUP_PRIORITY[a[0]] ?? 5) - (GROUP_PRIORITY[b[0]] ?? 5))
          .map(([group, fields]) => (
            <fieldset key={group} className="space-y-2">
              <legend className="text-[10px] font-semibold uppercase tracking-wider text-fg/30">{group}</legend>
              {fields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <label className="block text-[11px] text-fg/55">{f.label}</label>
                  {renderField(f)}
                  {f.help && f.kind !== 'boolean' && (
                    <p className="text-[10px] leading-tight text-fg/25">{f.help}</p>
                  )}
                </div>
              ))}
            </fieldset>
          ))}
      </div>
    </div>
  )
}
