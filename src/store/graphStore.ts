import { create } from 'zustand'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type XYPosition,
} from '@xyflow/react'
import type { DiscTally, NodeRunStatus } from '@shared/contracts'
import type { FtNodeData, NodeKind } from '@/registry/types'
import { getSpec } from '@/registry/nodeSpecs'
import { arePortsCompatible } from '@/registry/portTypes'

export type FtNode = Node<FtNodeData>

/** Is `goal` reachable from `start` following forward (non-feedback) edges only? */
function forwardReaches(start: string, goal: string, fwd: Edge[]): boolean {
  if (start === goal) return true
  const seen = new Set<string>()
  const stack = [start]
  while (stack.length) {
    const cur = stack.pop()!
    for (const e of fwd) {
      if (e.source !== cur) continue
      if (e.target === goal) return true
      if (!seen.has(e.target)) {
        seen.add(e.target)
        stack.push(e.target)
      }
    }
  }
  return false
}

/**
 * The return edge that closes a loop: `from`'s first output → `to`'s first
 * non-feedback, type-compatible input. Used to auto-complete a loop when the
 * user wires out→feedback but nothing yet feeds back to the source.
 */
function buildReturnEdge(nodes: FtNode[], fromId: string, toId: string): Edge | null {
  const from = nodes.find((n) => n.id === fromId)
  const to = nodes.find((n) => n.id === toId)
  if (!from || !to) return null
  const out = getSpec(from.data.kind).outputs[0]
  if (!out) return null
  const inPort = getSpec(to.data.kind).inputs.find((p) => !p.loopInternal && arePortsCompatible(out.type, p.type))
  if (!inPort) return null
  return {
    id: `auto-${fromId}-${toId}-${Math.random().toString(36).slice(2, 7)}`,
    source: fromId,
    sourceHandle: `out:${out.id}`,
    target: toId,
    targetHandle: `in:${inPort.id}`,
  }
}

export interface NodeRun {
  status: NodeRunStatus
  iteration?: number
  tail?: string
  error?: string
  costUsd?: number
  result?: string
  verdict?: { distribution: DiscTally; allCorrect: boolean; results: number; protoDir?: string }
}

const GROUP_SIZE = { width: 520, height: 320 }

let idSeq = 0
function makeId(kind: NodeKind): string {
  idSeq += 1
  return `${kind}-${idSeq.toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export interface GraphState {
  nodes: FtNode[]
  edges: Edge[]
  selectedNodeId: string | null
  selectedEdgeId: string | null
  runState: Record<string, NodeRun>
  activeEdgeIds: string[]
  currentRunId: string | null

  onNodesChange: (changes: NodeChange<FtNode>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (conn: Connection) => void

  addNode: (kind: NodeKind, position: XYPosition, parentId?: string) => string
  addPresetNode: (kind: NodeKind, position: XYPosition, label: string, config: Record<string, unknown>) => string
  updateNodeConfig: (id: string, key: string, value: unknown) => void
  updateNodeLabel: (id: string, label: string) => void
  updateEdgeData: (id: string, patch: Record<string, unknown>) => void
  deleteNode: (id: string) => void
  setSelected: (id: string | null) => void
  setSelectedEdge: (id: string | null) => void

  setGraph: (nodes: FtNode[], edges: Edge[]) => void

  setRunState: (id: string, run: Partial<NodeRun>) => void
  appendTail: (id: string, chunk: string) => void
  resetRun: () => void
  setActiveEdges: (ids: string[]) => void
  setCurrentRunId: (id: string | null) => void
}

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  runState: {},
  activeEdgeIds: [],
  currentRunId: null,

  onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),
  onConnect: (conn) => {
    const nodes = get().nodes
    const target = nodes.find((n) => n.id === conn.target)
    const port = target && getSpec(target.data.kind).inputs.find((p) => `in:${p.id}` === conn.targetHandle)
    if (!port?.loopInternal) {
      set({ edges: addEdge({ ...conn }, get().edges) })
      return
    }
    // An edge into a loopInternal `feedback` port is a loop back-edge; it carries
    // the loop config (mode + cap) in its data — click the arrow to edit.
    let edges = addEdge(
      { ...conn, type: 'feedback', data: { loopBackEdge: true, mode: 'until-pass', maxIterations: 3 } },
      get().edges,
    )
    // Auto-complete the loop: a back-edge alone isn't a cycle (the engine would
    // ignore it). If nothing yet feeds back (no forward path target→…→source),
    // add the return edge (source.out → target's first compatible input) so the
    // wired out→feedback becomes a REAL, runnable, iterating loop.
    const fwd = edges.filter((e) => e.type !== 'feedback')
    if (conn.source && conn.target && !forwardReaches(conn.target, conn.source, fwd)) {
      const ret = buildReturnEdge(nodes, conn.target, conn.source)
      if (ret) edges = addEdge(ret, edges)
    }
    set({ edges })
  },

  addNode: (kind, position, parentId) => {
    const spec = getSpec(kind)
    const id = makeId(kind)
    const node: FtNode = {
      id,
      type: spec.reactFlowType,
      position,
      data: { kind, label: spec.label, config: { ...spec.defaultConfig } },
      ...(spec.isContainer
        ? { style: { ...GROUP_SIZE }, }
        : {}),
      ...(parentId ? { parentId, extent: 'parent' as const } : {}),
    }
    // Container nodes must precede their children in the array.
    set({ nodes: spec.isContainer ? [node, ...get().nodes] : [...get().nodes, node], selectedNodeId: id })
    return id
  },

  addPresetNode: (kind, position, label, config) => {
    const spec = getSpec(kind)
    const id = makeId(kind)
    const node: FtNode = {
      id,
      type: spec.reactFlowType,
      position,
      data: { kind, label: label || spec.label, config: { ...spec.defaultConfig, ...config } },
    }
    set({ nodes: [...get().nodes, node], selectedNodeId: id })
    return id
  },

  updateNodeConfig: (id, key, value) =>
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, config: { ...n.data.config, [key]: value } } } : n,
      ),
    }),

  updateNodeLabel: (id, label) =>
    set({
      nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)),
    }),

  updateEdgeData: (id, patch) =>
    set({
      edges: get().edges.map((e) => (e.id === id ? { ...e, data: { ...(e.data ?? {}), ...patch } } : e)),
    }),

  deleteNode: (id) =>
    set({
      nodes: get().nodes.filter((n) => n.id !== id && n.parentId !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
    }),

  setSelected: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  setSelectedEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

  setGraph: (nodes, edges) =>
    set({ nodes, edges, selectedNodeId: null, selectedEdgeId: null, runState: {}, activeEdgeIds: [] }),

  setRunState: (id, run) =>
    set({ runState: { ...get().runState, [id]: { ...get().runState[id], ...run } as NodeRun } }),

  appendTail: (id, chunk) => {
    const prev = get().runState[id]
    const tail = ((prev?.tail ?? '') + chunk).slice(-2000)
    set({ runState: { ...get().runState, [id]: { ...(prev ?? { status: 'running' }), tail } } })
  },

  resetRun: () => set({ runState: {}, activeEdgeIds: [] }),
  setActiveEdges: (ids) => set({ activeEdgeIds: ids }),
  setCurrentRunId: (id) => set({ currentRunId: id }),
}))
