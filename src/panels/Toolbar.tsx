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

function topoOrder(nodes: FtNode[], allEdges: Edge[]): string[] {
  // Feedback edges are decorative (driver-carried), so they don't constrain order.
  const edges = allEdges.filter((e) => e.type !== 'feedback')
  const indeg = new Map(nodes.map((n) => [n.id, 0]))
  for (const e of edges) indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1)
  const queue = [...indeg.entries()].filter(([, d]) => d === 0).map(([id]) => id)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const e of edges.filter((x) => x.source === id)) {
      const d = (indeg.get(e.target) ?? 1) - 1
      indeg.set(e.target, d)
      if (d === 0) queue.push(e.target)
    }
  }
  for (const n of nodes) if (!order.includes(n.id)) order.push(n.id)
  return order
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
    for (const id of topoOrder(st.nodes, st.edges)) {
      st.setRunState(id, { status: 'running' })
      st.setActiveEdges(st.edges.filter((e) => e.source === id).map((e) => e.id))
      await sleep(650)
      st.setRunState(id, { status: 'done' })
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
          title="Preview only — animates edges/status. To really run a node, use the ▶ on the node (or in the Inspector)."
        >
          <Play className="size-3.5" /> Animate
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
            title="Really run the whole graph: forge → temper, iterating the loop until all-correct or the cap."
          >
            <CirclePlay className="size-3.5" /> Run Graph
          </button>
        )}
      </div>
    </div>
  )
}
