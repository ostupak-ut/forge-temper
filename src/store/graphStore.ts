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

export type FtNode = Node<FtNodeData>

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
    // Edges into a loopInternal port (Forge's `feedback`) are the real
    // Temper→Forge back-edge that DEFINES the loop. The edge carries both the
    // verdict (each iteration) AND the loop config in its data — click to edit.
    const target = get().nodes.find((n) => n.id === conn.target)
    const port = target && getSpec(target.data.kind).inputs.find((p) => `in:${p.id}` === conn.targetHandle)
    // The back-edge carries its own loop config (mode + cap) — click it to edit.
    const edge = port?.loopInternal
      ? { ...conn, type: 'feedback', data: { loopBackEdge: true, mode: 'until-pass', maxIterations: 3 } }
      : { ...conn }
    set({ edges: addEdge(edge, get().edges) })
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
