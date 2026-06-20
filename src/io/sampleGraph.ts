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

/**
 * A ready-made Idea → Forge → Temper → Body → Assemble pipeline. The Temper→Forge
 * back-edge IS the loop: it carries Temper's verdict back into Forge each
 * iteration. Click the arrow to set its mode + max-iterations (defaults baked in).
 */
export function buildStarterGraph(): { nodes: FtNode[]; edges: Edge[] } {
  const nodes: FtNode[] = [
    node('idea-1', 'idea', { x: 40, y: 140 }),
    node('forge-1', 'forge', { x: 340, y: 120 }),
    node('temper-1', 'temper', { x: 660, y: 120 }),
    node('body-1', 'body', { x: 980, y: 60 }),
    node('assemble-1', 'assemble', { x: 1280, y: 120 }),
  ]
  const edges: Edge[] = [
    edge('e1', 'idea-1', 'idea', 'forge-1', 'idea'),
    edge('e2', 'forge-1', 'paper', 'temper-1', 'paper'),
    edge('e3', 'temper-1', 'verified', 'body-1', 'verified'),
    edge('e4', 'body-1', 'section', 'assemble-1', 'section'),
    // The loop: Temper's verdict flows back into Forge until all-correct or the cap.
    {
      ...edge('e-fb', 'temper-1', 'report', 'forge-1', 'feedback'),
      type: 'feedback',
      data: { loopBackEdge: true, mode: 'until-pass', maxIterations: 3 },
    },
  ]
  return { nodes, edges }
}
