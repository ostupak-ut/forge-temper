import { useEffect, useRef, useState } from 'react'
import { Check, GitMerge, MessageSquarePlus, Send, Sparkles, Wand2, X } from 'lucide-react'
import type { Edge } from '@xyflow/react'
import { useGraphStore, type FtNode } from '@/store/graphStore'
import { parseGraph, requestDesign, type ChatMsg, type ParsedGraph } from '@/io/designApi'
import {
  clearDesignChat,
  loadDesignChat,
  loadDesignPrefs,
  saveDesignChat,
  saveDesignPrefs,
} from '@/io/designHistory'
import { fetchModels, type ModelInfo } from '@/run/providerModels'

const PROVIDERS = [
  { value: 'claude-code', label: 'Claude Code (subscription)' },
  { value: 'codex', label: 'Codex (subscription)' },
  { value: 'openrouter', label: 'OpenRouter (API key)' },
]

type ModelOpt = { value: string; label: string }

// Static menus for the subscription CLIs. OpenRouter's models are fetched live
// (with Claude models filtered out — use Claude Code for those, not OpenRouter).
const STATIC_MODELS: Record<string, ModelOpt[]> = {
  'claude-code': [
    { value: 'inherit', label: 'Default (session)' },
    { value: 'claude-opus-4-8', label: 'Opus 4.8' },
    { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
    { value: 'claude-haiku-4-5', label: 'Haiku 4.5' },
  ],
  codex: [
    { value: 'inherit', label: 'Default (session)' },
    { value: 'gpt-5.5', label: 'GPT-5.5' },
    { value: 'gpt-5.4', label: 'GPT-5.4' },
    { value: 'gpt-5.4-mini', label: 'GPT-5.4 mini' },
    { value: 'gpt-5.3-codex-spark', label: 'Codex Spark' },
  ],
}

const firstModel = (provider: string): string => STATIC_MODELS[provider]?.[0]?.value ?? 'inherit'

interface Turn extends ChatMsg {
  graph?: ParsedGraph | null
  /** assistant prose with any ```json fence stripped, for display */
  display?: string
}

const stripFences = (t: string) => t.replace(/```(?:json)?[\s\S]*?```/g, '').trim()

/** Rebuild displayable turns (Apply buttons, prose) from stored role+content. */
function hydrate(msgs: ChatMsg[]): Turn[] {
  return msgs.map((m) =>
    m.role === 'assistant'
      ? { ...m, graph: parseGraph(m.content), display: stripFences(m.content) || '(generated a workflow)' }
      : m,
  )
}

const strip = (turns: Turn[]): ChatMsg[] => turns.map((t) => ({ role: t.role, content: t.content }))

/** Snapshot of what already exists — current canvas + Library files — so the
 * designer can build AROUND it (e.g. wire in a file the user already dropped). */
async function gatherContext(): Promise<string> {
  const parts: string[] = []
  const nodes = useGraphStore.getState().nodes
  if (nodes.length) {
    const lines = nodes.map((n) => {
      const cfg = n.data.config as Record<string, unknown>
      const paths = Array.isArray(cfg?.paths) ? (cfg.paths as unknown[]).map(String) : []
      const extra = n.data.kind === 'file' && paths.length ? ` → ${paths.join(', ')}` : ''
      return `  - id=${n.id} "${n.data.label}" (${n.data.kind})${extra}`
    })
    parts.push(`Current canvas (${nodes.length} node${nodes.length === 1 ? '' : 's'}):\n${lines.join('\n')}`)
  }
  try {
    const r = await fetch('/api/fs/list?path=library')
    const d = await r.json()
    const items = (d.items ?? []) as { name: string; dir: boolean; rel: string }[]
    if (items.length) {
      parts.push(
        `Files already in the Library (use these paths in File nodes):\n${items
          .map((i) => `  - ${i.rel}${i.dir ? '/' : ''}`)
          .join('\n')}`,
      )
    }
  } catch {
    /* library may be empty / unreachable — fine */
  }
  return parts.join('\n\n')
}

export function DesignChat({ onClose, workflow }: { onClose: () => void; workflow: string | null }) {
  const setGraph = useGraphStore((s) => s.setGraph)
  const prefs = loadDesignPrefs()
  const initProvider = prefs.provider && PROVIDERS.some((p) => p.value === prefs.provider) ? prefs.provider : 'claude-code'
  const initModel =
    initProvider === 'openrouter'
      ? prefs.model || '' // resolved once the live list loads
      : STATIC_MODELS[initProvider].some((m) => m.value === prefs.model)
        ? prefs.model!
        : firstModel(initProvider)
  const [provider, setProvider] = useState(initProvider)
  const [model, setModel] = useState(initModel)
  const [orModels, setOrModels] = useState<ModelInfo[]>([])
  const [turns, setTurns] = useState<Turn[]>(() => hydrate(loadDesignChat(workflow)))
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const [appliedAt, setAppliedAt] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Abort any in-flight request if the panel closes.
  useEffect(() => () => abortRef.current?.abort(), [])

  const cancel = () => abortRef.current?.abort()

  // Reload this workflow's saved conversation when the active flow changes.
  useEffect(() => {
    setTurns(hydrate(loadDesignChat(workflow)))
  }, [workflow])

  useEffect(() => {
    saveDesignPrefs({ provider, model })
  }, [provider, model])

  // OpenRouter: pull the live catalog, drop Claude models (use Claude Code for
  // those), and make sure a non-Claude model ends up selected.
  useEffect(() => {
    if (provider !== 'openrouter') return
    let alive = true
    void fetchModels('openrouter').then((ms) => {
      if (!alive) return
      const list = ms.filter((m) => !m.id.toLowerCase().startsWith('anthropic/'))
      setOrModels(list)
      setModel((cur) => (cur && list.some((m) => m.id === cur) ? cur : (list[0]?.id ?? cur)))
    })
    return () => {
      alive = false
    }
  }, [provider])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, busy])

  const onProvider = (p: string) => {
    setProvider(p)
    setModel(p === 'openrouter' ? '' : firstModel(p))
  }

  const newChat = () => {
    if (turns.length && !window.confirm('Start a new chat? This clears the saved conversation for this workflow.')) return
    abortRef.current?.abort() // kill any in-flight design (server aborts its subprocess too)
    setTurns([])
    clearDesignChat(workflow)
    setError('')
    setBusy(false)
  }

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    setError('')
    const withUser: Turn[] = [...turns, { role: 'user', content: text }]
    setTurns(withUser)
    saveDesignChat(workflow, strip(withUser))
    setInput('')
    const ac = new AbortController()
    abortRef.current = ac
    setBusy(true)
    setElapsed(0)
    const startedAt = Date.now()
    const timer = window.setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 500)
    try {
      const context = await gatherContext()
      const reply = await requestDesign(provider, model, strip(withUser), context, ac.signal)
      const graph = parseGraph(reply)
      const next: Turn[] = [
        ...withUser,
        { role: 'assistant', content: reply, graph, display: stripFences(reply) || '(generated a workflow)' },
      ]
      setTurns(next)
      saveDesignChat(workflow, strip(next))
    } catch (e) {
      if (!ac.signal.aborted) setError(String((e as Error)?.message ?? e))
    } finally {
      window.clearInterval(timer)
      abortRef.current = null
      setBusy(false)
    }
  }

  const flash = () => {
    setAppliedAt(Date.now())
    setTimeout(() => setAppliedAt(null), 1800)
  }

  // Replace the whole canvas with the generated graph.
  const apply = (g: ParsedGraph) => {
    setGraph(g.nodes, g.edges)
    flash()
  }

  // Merge into the canvas: update nodes whose id matches (keep their position),
  // add new nodes (offset right so they don't overlap), keep everything else,
  // and add only edges that aren't already there. Edits never delete the rest.
  const merge = (g: ParsedGraph) => {
    const st = useGraphStore.getState()
    const upd = new Map(g.nodes.map((n) => [n.id, n]))
    const curIds = new Set(st.nodes.map((n) => n.id))
    const offsetX = st.nodes.length ? Math.max(...st.nodes.map((n) => n.position.x)) + 360 : 0
    const nodes: FtNode[] = st.nodes.map((n) => {
      const u = upd.get(n.id)
      return u ? { ...n, type: u.type, data: u.data } : n // keep position, take new data/type
    })
    for (const u of g.nodes) {
      if (!curIds.has(u.id)) nodes.push({ ...u, position: { x: u.position.x + offsetX, y: u.position.y } })
    }
    const key = (e: Edge) => `${e.source}|${e.target}|${e.sourceHandle ?? ''}|${e.targetHandle ?? ''}`
    const have = new Set(st.edges.map(key))
    const edges: Edge[] = [...st.edges, ...g.edges.filter((e) => !have.has(key(e)))]
    setGraph(nodes, edges)
    flash()
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-[80vh] w-[36rem] flex-col rounded-xl border border-border/15 bg-card text-fg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border/10 px-4 py-3">
          <Wand2 className="size-4 text-temper" />
          <h2 className="text-sm font-semibold text-fg/90">Design with AI</h2>
          <span className="max-w-[8rem] truncate rounded bg-fg/10 px-1.5 py-0.5 text-[10px] text-fg/45">
            {workflow?.trim() || 'unsaved'}
          </span>
          <button
            onClick={newChat}
            title="New chat (clears this workflow's conversation)"
            className="rounded p-1 text-fg/45 hover:bg-fg/10 hover:text-fg/80"
          >
            <MessageSquarePlus className="size-4" />
          </button>
          <select
            value={provider}
            onChange={(e) => onProvider(e.target.value)}
            className="ml-auto rounded-md border border-border/15 bg-field px-2 py-1 text-[11px] text-fg/80 outline-none"
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value} className="bg-card">
                {p.label}
              </option>
            ))}
          </select>
          {provider === 'openrouter' ? (
            <>
              <input
                list="design-or-models"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={orModels.length ? 'pick or type a model…' : 'loading models…'}
                className="w-44 rounded-md border border-border/15 bg-field px-2 py-1 text-[11px] text-fg/80 outline-none"
              />
              <datalist id="design-or-models">
                {orModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.id}
                  </option>
                ))}
              </datalist>
            </>
          ) : (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="rounded-md border border-border/15 bg-field px-2 py-1 text-[11px] text-fg/80 outline-none"
            >
              {STATIC_MODELS[provider].map((m) => (
                <option key={m.value} value={m.value} className="bg-card">
                  {m.label}
                </option>
              ))}
            </select>
          )}
          <button onClick={onClose} className="rounded p-1 text-fg/40 hover:bg-fg/10">
            <X className="size-4" />
          </button>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {turns.length === 0 && (
            <div className="mx-auto mt-8 max-w-sm text-center text-xs text-fg/40">
              <Sparkles className="mx-auto mb-2 size-6 text-temper/70" />
              Describe the workflow you want and I'll build the graph. e.g.{' '}
              <span className="text-fg/60">
                "a research agent that gathers notes, a writer that drafts from them, and an editor that
                polishes — chain them and warehouse the result."
              </span>
            </div>
          )}
          {turns.map((t, i) => (
            <div key={i} className={t.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={
                  'max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ' +
                  (t.role === 'user' ? 'bg-temper/15 text-fg/90' : 'bg-fg/[0.06] text-fg/80')
                }
              >
                <p className="whitespace-pre-wrap">{t.role === 'assistant' ? t.display : t.content}</p>
                {t.role === 'assistant' && t.graph && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => apply(t.graph!)}
                      title="Replace the whole canvas with this graph"
                      className="flex items-center gap-1.5 rounded-md bg-emerald-500/20 px-2.5 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/30"
                    >
                      <Check className="size-3.5" />
                      Replace canvas · {t.graph.nodeCount}n {t.graph.edgeCount}e
                    </button>
                    <button
                      onClick={() => merge(t.graph!)}
                      title="Merge into the current canvas: update matching nodes, add new ones, keep the rest"
                      className="flex items-center gap-1.5 rounded-md bg-sky-500/20 px-2.5 py-1 text-[11px] font-medium text-sky-300 hover:bg-sky-500/30"
                    >
                      <GitMerge className="size-3.5" />
                      Merge into canvas
                    </button>
                  </div>
                )}
                {t.role === 'assistant' && !t.graph && (
                  <p className="mt-1 text-[10px] text-amber-400/80">No valid graph found in the reply — try rephrasing.</p>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-xs text-fg/55">
              <span className="inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-temper/30 border-t-temper" />
              <span>
                Designing… {elapsed}s
                {elapsed >= 20 ? ' · big models can take a minute' : ''}
              </span>
              <button
                onClick={cancel}
                className="rounded border border-border/15 px-1.5 py-0.5 text-[11px] text-fg/60 hover:bg-fg/10 hover:text-fg/90"
              >
                Cancel
              </button>
            </div>
          )}
          {error && <p className="text-xs text-rose-400">{error}</p>}
          {appliedAt && <p className="text-center text-xs text-emerald-300">Applied to canvas ✓</p>}
        </div>

        <div className="flex shrink-0 items-end gap-2 border-t border-border/10 p-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            rows={2}
            placeholder="Describe the workflow… (Enter to send, Shift+Enter for newline)"
            className="min-w-0 flex-1 resize-none rounded-md border border-border/15 bg-field px-2.5 py-2 text-xs text-fg/90 outline-none focus:border-temper"
          />
          <button
            onClick={() => void send()}
            disabled={busy || !input.trim()}
            className="flex items-center gap-1.5 rounded-md bg-temper/20 px-3 py-2 text-xs font-medium text-temper hover:bg-temper/30 disabled:opacity-50"
          >
            <Send className="size-3.5" />
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
