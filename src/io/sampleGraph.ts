import type { Edge } from '@xyflow/react'
import type { FtNode } from '@/store/graphStore'
import type { NodeKind } from '@/registry/types'
import { getSpec } from '@/registry/nodeSpecs'

function node(id: string, kind: NodeKind, position: { x: number; y: number }, extra: Partial<FtNode> = {}): FtNode {
  const spec = getSpec(kind)
  return {
    id,
    type: spec.reactFlowType,
    position,
    data: { kind, label: spec.label, config: { ...spec.defaultConfig } },
    ...extra,
  }
}

const edge = (id: string, source: string, sh: string, target: string, th: string): Edge => ({
  id,
  source,
  target,
  sourceHandle: `out:${sh}`,
  targetHandle: `in:${th}`,
})

/** A ready-made InfoCard → Loop[Forge↔Temper] → Body → Assemble pipeline. */
export function buildStarterGraph(): { nodes: FtNode[]; edges: Edge[] } {
  const nodes: FtNode[] = [
    node('loop-1', 'loop', { x: 360, y: 20 }, { style: { width: 540, height: 300 } }),
    node('idea-1', 'idea', { x: 40, y: 120 }),
    node('forge-1', 'forge', { x: 40, y: 90 }, { parentId: 'loop-1', extent: 'parent' }),
    node('temper-1', 'temper', { x: 300, y: 90 }, { parentId: 'loop-1', extent: 'parent' }),
    node('body-1', 'body', { x: 980, y: 40 }),
    node('assemble-1', 'assemble', { x: 1260, y: 100 }),
  ]
  const edges: Edge[] = [
    edge('e1', 'idea-1', 'idea', 'forge-1', 'idea'),
    edge('e2', 'forge-1', 'paper', 'temper-1', 'paper'),
    edge('e3', 'temper-1', 'verified', 'body-1', 'verified'),
    edge('e4', 'body-1', 'section', 'assemble-1', 'section'),
    { ...edge('e-fb', 'temper-1', 'report', 'forge-1', 'feedback'), type: 'feedback' },
  ]
  return { nodes, edges }
}
