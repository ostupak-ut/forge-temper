import { compileGraph } from './compile'
import { schedule } from './scheduler'
import type { GraphEdge, GraphNode } from './runOneNode'

export { runOneNode, allowedToolsFor, effectiveWorkingDir } from './runOneNode'
export type { GraphNode, GraphEdge, RunOneResult, NodeVerdict } from './runOneNode'
export { compileGraph } from './compile'
export type { CompiledGraph, LoopPlan, Super } from './compile'
export { runLoop } from './loopDriver'
export { schedule } from './scheduler'

export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/**
 * Execute a whole graph: compile (split forward/feedback edges, detect cycles,
 * condense loops) then schedule sequentially. Cycles iterate via the loop driver.
 */
export async function runGraph(graph: Graph, runId: string, signal: AbortSignal): Promise<void> {
  const nodes = graph.nodes ?? []
  const edges = graph.edges ?? []
  const compiled = compileGraph(nodes, edges)
  await schedule(compiled, nodes, edges, runId, signal)
}
