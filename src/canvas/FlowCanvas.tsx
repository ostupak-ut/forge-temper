import { useCallback, useMemo } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  type Connection,
  type Edge,
  getOutgoers,
  MarkerType,
  MiniMap,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react'
import { useGraphStore, type FtNode } from '@/store/graphStore'
import { nodeTypes } from '@/nodes/nodeTypes'
import { edgeTypes } from '@/edges/edgeTypes'
import { getSpec } from '@/registry/nodeSpecs'
import { arePortsCompatible, handleId, PORT_COLOR } from '@/registry/portTypes'
import type { NodeKind, Port } from '@/registry/types'

const DRAG_MIME = 'application/ft-node'

function portOf(
  nodes: FtNode[],
  nodeId: string | null,
  dir: 'in' | 'out',
  handle: string | null,
): Port | null {
  if (!nodeId || !handle) return null
  const node = nodes.find((n) => n.id === nodeId)
  if (!node) return null
  const ports = dir === 'out' ? getSpec(node.data.kind).outputs : getSpec(node.data.kind).inputs
  return ports.find((p) => handleId(dir, p.id) === handle) ?? null
}

/** Would adding source→target close a cycle in the (outer) graph? */
function wouldCreateCycle(nodes: FtNode[], edges: Edge[], source: string, target: string): boolean {
  if (source === target) return true
  const targetNode = nodes.find((n) => n.id === target)
  if (!targetNode) return false
  const seen = new Set<string>()
  const stack = [targetNode]
  while (stack.length) {
    const cur = stack.pop()!
    for (const out of getOutgoers(cur, nodes, edges)) {
      if (out.id === source) return true
      if (!seen.has(out.id)) {
        seen.add(out.id)
        stack.push(out)
      }
    }
  }
  return false
}

export function FlowCanvas() {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const activeEdgeIds = useGraphStore((s) => s.activeEdgeIds)
  const onNodesChange = useGraphStore((s) => s.onNodesChange)
  const onEdgesChange = useGraphStore((s) => s.onEdgesChange)
  const onConnect = useGraphStore((s) => s.onConnect)
  const addNode = useGraphStore((s) => s.addNode)
  const setSelected = useGraphStore((s) => s.setSelected)
  const setSelectedEdge = useGraphStore((s) => s.setSelectedEdge)

  const { screenToFlowPosition } = useReactFlow()

  const isValidConnection = useCallback(
    (c: Connection | Edge) => {
      const srcPort = portOf(nodes, c.source, 'out', c.sourceHandle ?? null)
      const tgtPort = portOf(nodes, c.target, 'in', c.targetHandle ?? null)
      if (!srcPort || !tgtPort) return false
      if (!arePortsCompatible(srcPort.type, tgtPort.type)) return false
      // A loopInternal target (Forge's feedback) is allowed to close the visual
      // loop; every other connection must keep the outer graph acyclic.
      if (!tgtPort.loopInternal && wouldCreateCycle(nodes, edges, c.source, c.target)) return false
      return true
    },
    [nodes, edges],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const kind = e.dataTransfer.getData(DRAG_MIME) as NodeKind
      if (!kind) return
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      addNode(kind, pos)
    },
    [addNode, screenToFlowPosition],
  )

  const displayEdges = useMemo(
    () =>
      edges.map((e) => {
        const active = activeEdgeIds.includes(e.id)
        if (e.type === 'feedback') {
          // Self-styled custom edge; just pass the active flag through.
          return { ...e, data: { ...(e.data ?? {}), active } }
        }
        const src = portOf(nodes, e.source, 'out', e.sourceHandle ?? null)?.type
        const color = src ? PORT_COLOR[src] : '#64748b'
        return {
          ...e,
          animated: active,
          style: { stroke: active ? color : '#475569', strokeWidth: active ? 2.5 : 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: active ? color : '#475569' },
        }
      }),
    [edges, activeEdgeIds, nodes],
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={displayEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      onNodeClick={(_, n) => setSelected(n.id)}
      onEdgeClick={(_, e) => setSelectedEdge(e.id)}
      onPaneClick={() => {
        setSelected(null)
        setSelectedEdge(null)
      }}
      onDrop={onDrop}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      }}
      defaultEdgeOptions={{ type: 'default' }}
      proOptions={{ hideAttribution: true }}
      deleteKeyCode={['Delete', 'Backspace']}
      fitView
      minZoom={0.2}
      maxZoom={2}
    >
      <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#1e293b" />
      <MiniMap
        pannable
        zoomable
        className="!bg-[#0b0f17]"
        style={{ width: 132, height: 92 }}
        nodeColor={(n) => getSpec((n.data as FtNode['data']).kind).color}
      />
      <Controls className="!bg-[#121826] !text-white" />
    </ReactFlow>
  )
}

export { DRAG_MIME }
