import { useEffect, useRef, useState } from 'react'
import { Play, Repeat, Square, Trash2, Upload } from 'lucide-react'
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
  idle: 'bg-white/10 text-white/50',
  queued: 'bg-amber-400/20 text-amber-300',
  running: 'bg-temper/20 text-temper',
  done: 'bg-emerald-400/20 text-emerald-300',
  error: 'bg-red-500/20 text-red-300',
  skipped: 'bg-white/5 text-white/30',
}

const inputCls =
  'w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/90 outline-none focus:border-temper'

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
        className="flex shrink-0 items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 text-xs text-white/70 hover:bg-white/10 disabled:opacity-50"
      >
        <Upload className="size-3" />
        {busy ? '…' : 'Choose'}
      </button>
      <input ref={ref} type="file" className="hidden" onChange={onFile} />
    </div>
  )
}

/** Model picker: a Claude dropdown for claude-code, a free-text + datalist for other providers. */
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
    if (provider !== 'claude-code') fetchModels(provider).then(setModels)
  }, [provider])

  if (provider === 'claude-code') {
    return (
      <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#121826]">
            {o.label}
          </option>
        ))}
      </select>
    )
  }
  const listId = `models-${provider}`
  return (
    <>
      <input
        className={inputCls + ' font-mono'}
        list={listId}
        value={value === 'inherit' ? '' : value}
        placeholder="e.g. openai/gpt-5.1, anthropic/claude-sonnet-4.5"
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </datalist>
    </>
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
                : 'border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white/80')
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
    <div className="mt-1.5 border-t border-white/10 pt-1.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Output</span>
        {pdf && (
          <a href={raw(pdf.rel)} target="_blank" rel="noreferrer" className="text-[10px] text-temper hover:underline">
            open full ↗
          </a>
        )}
      </div>
      {pdf && (
        <iframe title="paper" src={raw(pdf.rel)} className="h-72 w-full rounded border border-white/10 bg-white" />
      )}
      {docs.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {docs.map((f) => (
            <a
              key={f.rel}
              href={raw(f.rel)}
              target="_blank"
              rel="noreferrer"
              className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/55 hover:bg-white/10"
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
}: {
  edge: Edge
  updateEdgeData: (id: string, patch: Record<string, unknown>) => void
  onDelete: () => void
}) {
  const isLoop = edge.type === 'feedback' || Boolean((edge.data as { loopBackEdge?: unknown })?.loopBackEdge)
  const data = (edge.data ?? {}) as { mode?: string; maxIterations?: number }
  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-white/10 bg-[#0d1320]">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <Repeat className="size-4 text-rose-400" />
        <span className="flex-1 text-sm font-medium text-white/90">{isLoop ? 'Loop' : 'Connection'}</span>
        <button
          onClick={onDelete}
          title={isLoop ? 'Remove the loop (delete this arrow)' : 'Delete this edge'}
          className="rounded p-1 text-white/40 hover:bg-red-500/20 hover:text-red-300"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-auto p-3">
        {isLoop ? (
          <>
            <p className="text-[11px] leading-tight text-white/35">
              This arrow is the loop: Temper’s verdict flows back into Forge each iteration until all results are
              correct or the cap is hit.
            </p>
            <div className="space-y-1">
              <label className="block text-[11px] text-white/55">Mode</label>
              <select
                className={inputCls}
                value={data.mode ?? 'until-pass'}
                onChange={(e) => updateEdgeData(edge.id, { mode: e.target.value })}
              >
                <option value="until-pass" className="bg-[#121826]">
                  Until pass (smart: temper all-correct)
                </option>
                <option value="until-count" className="bg-[#121826]">
                  Until count (fixed iterations)
                </option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] text-white/55">Max iterations</label>
              <input
                type="number"
                className={inputCls}
                min={1}
                max={20}
                step={1}
                value={Number(data.maxIterations ?? 3)}
                onChange={(e) => updateEdgeData(edge.id, { maxIterations: e.target.value === '' ? '' : Number(e.target.value) })}
              />
              <p className="text-[10px] leading-tight text-white/25">Always a hard cap, even in smart mode.</p>
            </div>
          </>
        ) : (
          <p className="text-[11px] leading-tight text-white/35">
            A data connection. Select the Temper→Forge feedback arrow to configure the loop.
          </p>
        )}
      </div>
    </div>
  )
}

export function Inspector() {
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

  if (!node || !selectedId) {
    if (edge && selectedEdgeId) {
      return (
        <EdgeInspector
          edge={edge}
          updateEdgeData={updateEdgeData}
          onDelete={() => {
            onEdgesChange([{ id: edge.id, type: 'remove' }])
            setSelectedEdge(null)
          }}
        />
      )
    }
    return (
      <div className="grid h-full w-80 shrink-0 place-items-center border-l border-white/10 bg-[#0d1320] p-4 text-center text-xs text-white/30">
        Select a node — or the loop arrow — to edit its config.
      </div>
    )
  }

  const spec = getSpec(node.data.kind)
  const cfg = node.data.config
  const Icon = resolveNodeIcon(cfg.symbol, spec.icon)
  const variables = spec.inputs.map((p) => p.id)

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
          <label className="flex items-center gap-2 text-xs text-white/70">
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
      case 'select':
        return (
          <select className={inputCls} value={String(value ?? '')} onChange={(e) => set(e.target.value)}>
            {(f.options ?? []).map((o) => (
              <option key={o.value} value={o.value} className="bg-[#121826]">
                {o.label}
              </option>
            ))}
          </select>
        )
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
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-white/10 bg-[#0d1320]">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <Icon className="size-4" style={{ color: spec.color }} />
        <input
          className="flex-1 bg-transparent text-sm font-medium text-white/90 outline-none"
          value={node.data.label}
          onChange={(e) => updateNodeLabel(selectedId, e.target.value)}
        />
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
        <button
          onClick={() => deleteNode(selectedId)}
          title="Delete node"
          className="rounded p-1 text-white/40 hover:bg-red-500/20 hover:text-red-300"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-3">
        <p className="text-[11px] leading-tight text-white/35">{spec.description}</p>

        {run && (
          <div className="rounded-lg border border-white/10 bg-black/30 p-2 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white/60">Run</span>
              <span className={'rounded px-1.5 py-0.5 text-[10px] ' + STATUS_PILL[run.status]}>{run.status}</span>
              {run.costUsd != null && (
                <span
                  className="ml-auto text-white/40"
                  title="API-rate estimate. On a Claude subscription this is not billed — it counts against your plan usage."
                >
                  ~${run.costUsd.toFixed(4)} est.
                </span>
              )}
            </div>
            {run.verdict && (
              <div className="mt-1.5 border-t border-white/10 pt-1.5">
                <DiscBar tally={run.verdict.distribution} allCorrect={run.verdict.allCorrect} />
                <p className="mt-0.5 text-[10px] text-white/30">{run.verdict.results} results checked</p>
              </div>
            )}
            {run.error && <p className="mt-1 text-red-400">{run.error}</p>}
            {(run.result || run.tail) && (
              <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-snug text-white/55">
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

        {[...groups.entries()].map(([group, fields]) => (
          <fieldset key={group} className="space-y-2">
            <legend className="text-[10px] font-semibold uppercase tracking-wider text-white/30">{group}</legend>
            {fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <label className="block text-[11px] text-white/55">{f.label}</label>
                {renderField(f)}
                {f.help && f.kind !== 'boolean' && (
                  <p className="text-[10px] leading-tight text-white/25">{f.help}</p>
                )}
              </div>
            ))}
          </fieldset>
        ))}
      </div>
    </div>
  )
}
