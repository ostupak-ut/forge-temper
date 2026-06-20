import { useCallback, useEffect, useState } from 'react'
import { CirclePlay, Download, FilePlus2, FolderOpen, Play, Save, SaveAll, Sparkles, Square, Trash2, Upload } from 'lucide-react'
import { useGraphStore } from '@/store/graphStore'
import { buildStarterGraph } from '@/io/sampleGraph'
import { runGraph, stopCurrentRun } from '@/run/runController'
import { downloadGraph, loadGraphFromFile, serializeGraph } from '@/io/serialize'
import { deleteFlow, listFlows, loadFlow, saveFlow, type FlowMeta } from '@/io/flowsApi'
import type { FtNode } from '@/store/graphStore'
import type { Edge } from '@xyflow/react'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type DryStep = { id: string; iteration?: number }

const reachOver = (start: string, adj: Map<string, string[]>): Set<string> => {
  const seen = new Set<string>([start])
  const q = [start]
  while (q.length) {
    const n = q.shift()!
    for (const m of adj.get(n) ?? []) if (!seen.has(m)) { seen.add(m); q.push(m) }
  }
  return seen
}

/** Topo-sort a loop body over forward edges; back-edge target first, source last. */
function topoBody(body: Set<string>, fAdj: Map<string, string[]>, targetId: string, sourceId: string): string[] {
  const indeg = new Map<string, number>()
  for (const id of body) indeg.set(id, 0)
  const adj = new Map<string, string[]>()
  for (const [s, ts] of fAdj) {
    if (!body.has(s)) continue
    for (const t of ts) {
      if (!body.has(t)) continue
      ;(adj.get(s) ?? adj.set(s, []).get(s)!).push(t)
      indeg.set(t, (indeg.get(t) ?? 0) + 1)
    }
  }
  const ready = [...body].filter((id) => (indeg.get(id) ?? 0) === 0)
  ready.sort((a, b) => (a === targetId ? -1 : b === targetId ? 1 : 0))
  const order: string[] = []
  const seen = new Set<string>()
  while (ready.length) {
    const n = ready.shift()!
    if (seen.has(n)) continue
    seen.add(n)
    order.push(n)
    for (const m of adj.get(n) ?? []) {
      indeg.set(m, (indeg.get(m) ?? 0) - 1)
      if ((indeg.get(m) ?? 0) <= 0 && !seen.has(m)) ready.push(m)
    }
  }
  for (const id of body) if (!seen.has(id)) order.push(id)
  return [...order.filter((id) => id !== sourceId), sourceId]
}

/**
 * Build the dry-run animation sequence — loop-aware, mirroring the engine: each
 * loop body (a feedback edge that truly closes a cycle) is repeated its
 * maxIterations, tagged with the iteration number; everything else runs once in
 * topo order over forward edges.
 */
function dryRunSequence(nodes: FtNode[], allEdges: Edge[]): DryStep[] {
  const fwd = allEdges.filter((e) => e.type !== 'feedback')
  const feedback = allEdges.filter((e) => e.type === 'feedback')

  const fAdj = new Map<string, string[]>()
  const rAdj = new Map<string, string[]>()
  for (const e of fwd) {
    ;(fAdj.get(e.source) ?? fAdj.set(e.source, []).get(e.source)!).push(e.target)
    ;(rAdj.get(e.target) ?? rAdj.set(e.target, []).get(e.target)!).push(e.source)
  }

  type Loop = { id: string; order: string[]; n: number }
  const loops: Loop[] = []
  const loopOf = new Map<string, string>()
  feedback.forEach((fb, i) => {
    const fromTarget = reachOver(fb.target, fAdj)
    if (!fromTarget.has(fb.source)) return // dangling feedback edge — not a real loop
    const toSource = reachOver(fb.source, rAdj)
    const body = new Set<string>([fb.target, fb.source])
    for (const id of fromTarget) if (toSource.has(id)) body.add(id)
    if ([...body].some((id) => loopOf.has(id))) return // one cycle per node
    const order = topoBody(body, fAdj, fb.target, fb.source)
    const data = (fb.data ?? {}) as { maxIterations?: number }
    const n = Math.max(1, Math.floor(Number(data.maxIterations)) || 3)
    const id = `loop-${i}`
    loops.push({ id, order, n })
    for (const nid of body) loopOf.set(nid, id)
  })

  // Condensation: each loop body collapses to one super-node; topo-sort supers.
  const sup = (nid: string) => loopOf.get(nid) ?? nid
  const supers = new Set<string>(nodes.map((n) => sup(n.id)))
  const sAdj = new Map<string, Set<string>>()
  const indeg = new Map<string, number>()
  for (const s of supers) indeg.set(s, 0)
  for (const e of fwd) {
    const s = sup(e.source)
    const t = sup(e.target)
    if (s === t) continue
    const set = sAdj.get(s) ?? sAdj.set(s, new Set()).get(s)!
    if (!set.has(t)) {
      set.add(t)
      indeg.set(t, (indeg.get(t) ?? 0) + 1)
    }
  }
  const ready = [...supers].filter((s) => (indeg.get(s) ?? 0) === 0)
  const ordered: string[] = []
  const seen = new Set<string>()
  while (ready.length) {
    const s = ready.shift()!
    if (seen.has(s)) continue
    seen.add(s)
    ordered.push(s)
    for (const t of sAdj.get(s) ?? []) {
      indeg.set(t, (indeg.get(t) ?? 0) - 1)
      if ((indeg.get(t) ?? 0) <= 0 && !seen.has(t)) ready.push(t)
    }
  }
  for (const s of supers) if (!seen.has(s)) ordered.push(s)

  const steps: DryStep[] = []
  for (const s of ordered) {
    const loop = loops.find((l) => l.id === s)
    if (loop) {
      for (let it = 1; it <= loop.n; it++) for (const id of loop.order) steps.push({ id, iteration: it })
    } else {
      steps.push({ id: s })
    }
  }
  return steps
}

const CURRENT_KEY = 'ft.currentFlow'
const btn =
  'flex items-center gap-1.5 rounded-md border border-border/10 bg-field px-2.5 py-1 text-xs text-fg/80 transition hover:border-border/25 hover:bg-fg/[0.08] disabled:opacity-40'

export function Toolbar() {
  const setGraph = useGraphStore((s) => s.setGraph)
  const currentRunId = useGraphStore((s) => s.currentRunId)
  const [flows, setFlows] = useState<FlowMeta[]>([])
  const [current, setCurrent] = useState<string | null>(() => localStorage.getItem(CURRENT_KEY))
  const [dirtyMsg, setDirtyMsg] = useState<string>('')
  const [menuOpen, setMenuOpen] = useState(false)

  const refresh = useCallback(() => listFlows().then(setFlows), [])
  useEffect(() => void refresh(), [refresh])

  const setName = (name: string | null) => {
    setCurrent(name)
    if (name) localStorage.setItem(CURRENT_KEY, name)
    else localStorage.removeItem(CURRENT_KEY)
  }

  const flash = (m: string) => {
    setDirtyMsg(m)
    setTimeout(() => setDirtyMsg(''), 1500)
  }

  const onNew = () => {
    setGraph([], [])
    setName(null)
  }

  const onOpen = async (name: string) => {
    if (!name) return
    const doc = await loadFlow(name)
    if (doc) {
      setGraph(doc.nodes as FtNode[], doc.edges)
      setName(name)
    }
  }

  const doSave = async (name: string) => {
    const { nodes, edges } = useGraphStore.getState()
    const ok = await saveFlow(name, serializeGraph(nodes, edges))
    if (ok) {
      setName(name)
      await refresh()
      flash(`saved “${name}”`)
    }
  }

  const onSave = async () => {
    if (current) return doSave(current)
    return onSaveAs()
  }

  const onSaveAs = async () => {
    const name = window.prompt('Save flow as:', current ?? 'my-flow')?.trim()
    if (name) await doSave(name)
  }

  const onDelete = async () => {
    if (!current) return
    if (!window.confirm(`Delete flow “${current}”?`)) return
    await deleteFlow(current)
    setName(null)
    await refresh()
  }

  const delOne = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation()
    if (!window.confirm(`Delete flow “${name}”?`)) return
    await deleteFlow(name)
    if (current === name) setName(null)
    await refresh()
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void onSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [current])

  const onDemoRun = async () => {
    const st = useGraphStore.getState()
    st.resetRun()
    for (const step of dryRunSequence(st.nodes, st.edges)) {
      const iter = step.iteration ? { iteration: step.iteration } : {}
      st.setRunState(step.id, { status: 'running', ...iter })
      st.setActiveEdges(st.edges.filter((e) => e.source === step.id).map((e) => e.id))
      await sleep(450)
      st.setRunState(step.id, { status: 'done', ...iter })
    }
    st.setActiveEdges([])
  }

  return (
    <div className="flex items-center gap-2 border-b border-border/10 bg-field px-3 py-1.5">
      <button className={btn} onClick={onNew} title="New empty flow">
        <FilePlus2 className="size-3.5" /> New
      </button>
      <button
        className={btn + ' !border-amber-400/30 !bg-amber-500/10 text-amber-200 hover:!bg-amber-500/20'}
        title="Load the standard InfoCard → Loop[Forge↔Temper] → Body → Assemble workflow"
        onClick={() => {
          const g = buildStarterGraph()
          setGraph(g.nodes, g.edges)
          setName(null)
        }}
      >
        <Sparkles className="size-3.5" /> Starter
      </button>

      <div className="relative">
        <button
          className={btn}
          onClick={() => {
            void refresh()
            setMenuOpen((o) => !o)
          }}
          title="Open or manage saved flows"
        >
          <FolderOpen className="size-3.5" /> Open ▾
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute left-0 top-full z-20 mt-1 max-h-72 w-56 overflow-auto rounded-md border border-border/15 bg-card p-1 shadow-xl">
              {flows.length === 0 && (
                <p className="px-2 py-2 text-[11px] text-fg/40">No saved flows yet — use Save / Save As.</p>
              )}
              {flows.map((f) => (
                <div
                  key={f.name}
                  className="group flex items-center gap-1 rounded px-1.5 py-1 text-xs text-fg/80 hover:bg-fg/10"
                >
                  <button
                    className="min-w-0 flex-1 truncate text-left"
                    onClick={() => {
                      onOpen(f.name)
                      setMenuOpen(false)
                    }}
                  >
                    {f.name}
                  </button>
                  <button
                    className="rounded p-0.5 text-fg/25 opacity-0 hover:bg-red-500/20 hover:text-red-300 group-hover:opacity-100"
                    title={`Delete “${f.name}”`}
                    onClick={(e) => delOne(e, f.name)}
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <button className={btn} onClick={onSave} title="Save (Ctrl+S)">
        <Save className="size-3.5" /> Save
      </button>
      <button className={btn} onClick={onSaveAs} title="Save as a new name">
        <SaveAll className="size-3.5" /> Save As
      </button>

      <span className="ml-1 text-[11px] text-fg/40">
        {current ? <span className="text-fg/70">{current}</span> : <span className="italic">unsaved</span>}
        {dirtyMsg && <span className="ml-2 text-emerald-300">{dirtyMsg}</span>}
      </span>

      <div className="ml-auto flex items-center gap-2">
        <button
          className={btn}
          title="Export to a .json file"
          onClick={() => {
            const { nodes, edges } = useGraphStore.getState()
            downloadGraph(serializeGraph(nodes, edges), `${current ?? 'flow'}.ftflow.json`)
          }}
        >
          <Download className="size-3.5" />
        </button>
        <button
          className={btn}
          title="Import a .json file"
          onClick={async () => {
            const doc = await loadGraphFromFile()
            if (doc) {
              setGraph(doc.nodes as FtNode[], doc.edges)
              setName(null)
            }
          }}
        >
          <Upload className="size-3.5" />
        </button>
        <button
          className={btn}
          onClick={onDemoRun}
          title="Dry run — walks the flow order and animates edges/status WITHOUT calling any agent (no tokens spent). To really run, use Run Graph, or the ▶ on a node."
        >
          <Play className="size-3.5" /> Dry Run
        </button>
        {currentRunId ? (
          <button
            className={btn + ' !border-red-400/40 !bg-red-500/15 text-red-200 hover:!bg-red-500/25'}
            onClick={() => void stopCurrentRun()}
            title="Stop the running graph"
          >
            <Square className="size-3.5" /> Stop
          </button>
        ) : (
          <button
            className={btn + ' !border-emerald-400/40 !bg-emerald-500/15 text-emerald-200 hover:!bg-emerald-500/25'}
            onClick={() => void runGraph()}
            title="Run the whole graph: every node in dependency order, iterating any loops until they pass or hit the cap."
          >
            <CirclePlay className="size-3.5" /> Run Graph
          </button>
        )}
      </div>
    </div>
  )
}
