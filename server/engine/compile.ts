import { LoopConfig } from '@shared/contracts'
import type { GraphEdge, GraphNode } from './runOneNode'

/**
 * Compile a flat cyclic graph into an executable plan. The Temper→Forge
 * back-edge (an edge tagged `type:'feedback'` / `data.loopBackEdge`) DEFINES a
 * loop: its target (Forge) and source (Temper) bound the loop body. The body is
 * the strongly-connected component over the FORWARD edges plus that back-edge,
 * topo-sorted (back-edge target first … back-edge source last) so an inserted
 * `custom` node on the cycle iterates too. Nothing here hardcodes forge/temper.
 */

export interface LoopPlan {
  id: string
  /** The Temper→Forge feedback edge that defines this loop. */
  feedbackEdge: GraphEdge
  config: LoopConfig
  /** Body nodes in execution order: back-edge target (Forge) first, source (Temper) last. */
  bodyOrder: string[]
  /** The node the back-edge feeds INTO (where {{temper_report}}/{{feedback}} is injected). */
  backEdgeTargetId: string
  /** The node the back-edge comes FROM (whose verdict drives convergence). */
  verdictSourceId: string
}

/** A node in the condensation: either a plain node or a loop super-node. */
export type Super =
  | { kind: 'node'; id: string }
  | { kind: 'loop'; id: string; plan: LoopPlan }

export interface CompiledGraph {
  loops: LoopPlan[]
  /** Forward edges (everything except the feedback back-edges). */
  forwardDag: GraphEdge[]
  /** Super-nodes (loops collapsed) in arbitrary order; scheduler topo-sorts. */
  supers: Super[]
  /** Condensation edges between super-node ids. */
  superEdges: { source: string; target: string }[]
  errors: string[]
}

const isFeedback = (e: GraphEdge): boolean => e.type === 'feedback' || Boolean(e.data?.loopBackEdge)

/**
 * Body of a loop = all nodes that lie on a forward path from the back-edge
 * target back to the back-edge source. Generic SCC discovery: starting from the
 * target, follow forward edges; keep only nodes that can also reach the source.
 */
function discoverBody(targetId: string, sourceId: string, forward: GraphEdge[], nodeIds: Set<string>): string[] | null {
  // Forward reachability from target.
  const fwdAdj = new Map<string, string[]>()
  const revAdj = new Map<string, string[]>()
  for (const e of forward) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue
    ;(fwdAdj.get(e.source) ?? fwdAdj.set(e.source, []).get(e.source)!).push(e.target)
    ;(revAdj.get(e.target) ?? revAdj.set(e.target, []).get(e.target)!).push(e.source)
  }

  const reachFromTarget = bfs(targetId, fwdAdj)
  // A real loop requires a FORWARD path target→…→source. Without one the
  // back-edge is dangling — don't fabricate a meaningless 2-node loop.
  if (!reachFromTarget.has(sourceId)) return null
  const reachToSource = bfs(sourceId, revAdj)
  // Body = nodes reachable from target AND able to reach source (i.e. on the cycle).
  const body = new Set<string>([targetId, sourceId])
  for (const id of reachFromTarget) if (reachToSource.has(id)) body.add(id)

  // Topo-sort the body over forward edges (target first, source last).
  return topoBody(targetId, sourceId, body, fwdAdj)
}

function bfs(start: string, adj: Map<string, string[]>): Set<string> {
  const seen = new Set<string>([start])
  const q = [start]
  while (q.length) {
    const n = q.shift()!
    for (const m of adj.get(n) ?? []) if (!seen.has(m)) { seen.add(m); q.push(m) }
  }
  return seen
}

/** Kahn topo over the body subgraph; pin target first, source last as tie-breakers. */
function topoBody(targetId: string, sourceId: string, body: Set<string>, fwdAdj: Map<string, string[]>): string[] {
  const indeg = new Map<string, number>()
  for (const id of body) indeg.set(id, 0)
  const adj = new Map<string, string[]>()
  for (const [s, ts] of fwdAdj) {
    if (!body.has(s)) continue
    for (const t of ts) {
      if (!body.has(t)) continue
      ;(adj.get(s) ?? adj.set(s, []).get(s)!).push(t)
      indeg.set(t, (indeg.get(t) ?? 0) + 1)
    }
  }
  const ready = [...body].filter((id) => (indeg.get(id) ?? 0) === 0)
  // Ensure the back-edge target leads if it is a valid root.
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
  // Any body node the topo missed (cycle remnant) appended in stable order.
  for (const id of body) if (!seen.has(id)) order.push(id)
  // Force source to the end (it closes the loop).
  const withoutSource = order.filter((id) => id !== sourceId)
  return [...withoutSource, sourceId]
}

/**
 * Resolve a loop's LoopConfig from the feedback EDGE's own `data` (set by
 * clicking the arrow in the Inspector), else the Zod defaults (until-pass,
 * max 3). The arrow IS the loop — no separate controller node.
 */
function resolveLoopConfig(fb: GraphEdge): LoopConfig {
  const raw = (fb.data ?? {}) as Record<string, unknown>
  // Normalize before parsing: the Inspector number field persists '' when
  // cleared, which would make z.number() throw and abort the whole graph run.
  // Coerce blanks/invalid back to undefined so the Zod defaults apply.
  const n = typeof raw.maxIterations === 'number' ? raw.maxIterations : Number(raw.maxIterations)
  return LoopConfig.parse({
    mode: typeof raw.mode === 'string' && raw.mode ? raw.mode : undefined,
    maxIterations: Number.isFinite(n) && n > 0 ? n : undefined,
  })
}

export function compileGraph(nodes: GraphNode[], edges: GraphEdge[]): CompiledGraph {
  const errors: string[] = []
  const nodeIds = new Set(nodes.map((n) => n.id))
  const feedbackEdges = edges.filter(isFeedback)
  const forwardDag = edges.filter((e) => !isFeedback(e))

  const loops: LoopPlan[] = []
  const bodyMembership = new Map<string, string>() // nodeId -> loopId

  for (let i = 0; i < feedbackEdges.length; i++) {
    const fb = feedbackEdges[i]
    if (!nodeIds.has(fb.source) || !nodeIds.has(fb.target)) continue
    const loopId = `loop-${i + 1}`
    const bodyOrder = discoverBody(fb.target, fb.source, forwardDag, nodeIds)
    if (!bodyOrder) {
      errors.push(
        `feedback edge ${fb.source}→${fb.target} has no forward path back to its source — not a loop; ignoring it.`,
      )
      continue
    }
    const config = resolveLoopConfig(fb)
    for (const id of bodyOrder) {
      if (bodyMembership.has(id)) {
        errors.push(`node ${id} is shared by two loops; only one cycle per node is supported`)
      }
      bodyMembership.set(id, loopId)
    }
    loops.push({
      id: loopId,
      feedbackEdge: fb,
      config,
      bodyOrder,
      backEdgeTargetId: fb.target,
      verdictSourceId: fb.source,
    })
  }

  // Build the condensation: each loop body collapses to one super-node; every
  // other node is its own super-node. (loopcontrol nodes are scheduling no-ops:
  // they only supply config, so we exclude them from the runnable condensation.)
  const supers: Super[] = []
  const superIdForNode = new Map<string, string>()
  for (const loop of loops) {
    supers.push({ kind: 'loop', id: loop.id, plan: loop })
    for (const id of loop.bodyOrder) superIdForNode.set(id, loop.id)
  }
  for (const n of nodes) {
    if (superIdForNode.has(n.id)) continue
    if (n.data.kind === 'loopcontrol') continue // config-only, not executed
    supers.push({ kind: 'node', id: n.id })
    superIdForNode.set(n.id, n.id)
  }

  // Condensation edges over forward edges, collapsing intra-loop & dangling edges.
  const superEdgeSet = new Set<string>()
  const superEdges: { source: string; target: string }[] = []
  for (const e of forwardDag) {
    const s = superIdForNode.get(e.source)
    const t = superIdForNode.get(e.target)
    if (!s || !t || s === t) continue
    const key = `${s}->${t}`
    if (superEdgeSet.has(key)) continue
    superEdgeSet.add(key)
    superEdges.push({ source: s, target: t })
  }

  return { loops, forwardDag, supers, superEdges, errors }
}
