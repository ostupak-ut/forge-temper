import { emitEvent } from '../run/runEvents'
import { runOneNode } from './runOneNode'
import { runLoop } from './loopDriver'
import type { CompiledGraph, Super } from './compile'
import type { GraphEdge, GraphNode } from './runOneNode'

/**
 * Run a compiled graph SEQUENTIALLY (one agent/harness at a time). Kahn
 * topo-sort over the condensation (loops collapsed to super-nodes); plain
 * super-nodes run via runOneNode, loop super-nodes via runLoop. The AbortSignal
 * is respected before every super-node.
 */
export async function schedule(
  compiled: CompiledGraph,
  nodes: GraphNode[],
  edges: GraphEdge[],
  runId: string,
  signal: AbortSignal,
): Promise<void> {
  for (const err of compiled.errors) {
    emitEvent(runId, { type: 'error', nodeId: '', error: err })
  }

  const superById = new Map<string, Super>(compiled.supers.map((s) => [s.id, s]))
  const indeg = new Map<string, number>()
  for (const s of compiled.supers) indeg.set(s.id, 0)
  const adj = new Map<string, string[]>()
  for (const e of compiled.superEdges) {
    if (!superById.has(e.source) || !superById.has(e.target)) continue
    ;(adj.get(e.source) ?? adj.set(e.source, []).get(e.source)!).push(e.target)
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1)
  }

  const ready = [...indeg.entries()].filter(([, d]) => d === 0).map(([id]) => id)
  const done = new Set<string>()
  // Every node's text output, keyed by node id, so any downstream agent can EAT
  // it (runOneNode merges these into the matching input port's {{var}}).
  const results = new Map<string, string>()

  while (ready.length) {
    if (signal.aborted) break
    const id = ready.shift()!
    if (done.has(id)) continue
    done.add(id)

    const sup = superById.get(id)
    if (!sup) continue

    if (sup.kind === 'loop') {
      const report = await runLoop(sup.plan, nodes, edges, runId, signal, undefined, Object.fromEntries(results))
      // Expose the loop's output under its verdict source (e.g. Temper) so
      // downstream nodes wired from it pick it up.
      if (report) results.set(sup.plan.verdictSourceId, report)
    } else {
      const node = nodes.find((n) => n.id === sup.id)
      if (node && node.data.kind !== 'loopcontrol') {
        if (signal.aborted) break
        // The provider emits its own status/token/result events; we only need
        // to surface a thrown error (e.g. the needsAgent gate).
        try {
          const res = await runOneNode(node, nodes, edges, runId, signal, { results: Object.fromEntries(results) })
          if (res.result) results.set(node.id, res.result)
        } catch (e) {
          emitEvent(runId, { type: 'error', nodeId: node.id, error: String((e as Error)?.message ?? e) })
        }
      }
    }

    for (const m of adj.get(id) ?? []) {
      indeg.set(m, (indeg.get(m) ?? 0) - 1)
      if ((indeg.get(m) ?? 0) <= 0 && !done.has(m)) ready.push(m)
    }
  }

  // Fail loud: an untagged forward cycle leaves super-nodes unreachable by Kahn.
  if (!signal.aborted && done.size < compiled.supers.length) {
    const missed = compiled.supers.filter((s) => !done.has(s.id)).map((s) => s.id)
    emitEvent(runId, {
      type: 'error',
      nodeId: '',
      error: `unresolved cycle in the graph — these were skipped: ${missed.join(', ')}. Mark a Temper→Forge edge as the loop's feedback edge.`,
    })
  }
}
