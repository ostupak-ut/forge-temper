import { emitEvent } from '../run/runEvents'
import { runOneNode, effectiveWorkingDir } from './runOneNode'
import { runLoop } from './loopDriver'
import type { CompiledGraph, Super } from './compile'
import type { GraphEdge, GraphNode } from './runOneNode'

export interface ScheduleOpts {
  /** Run independent same-stage nodes concurrently (capped + working-dir guarded). */
  parallel?: boolean
  /** Max agents in flight at once when parallel (default 3). */
  concurrency?: number
}

/**
 * Run a compiled graph. Kahn topo-sort over the condensation (loops collapsed to
 * super-nodes); plain super-nodes run via runOneNode, loop super-nodes via
 * runLoop. By default nodes run SEQUENTIALLY (one at a time). With opts.parallel
 * the ready set (independent same-stage nodes) runs concurrently behind a
 * concurrency cap and a per-working-dir mutex, so two nodes sharing a
 * papers/<id> never write it at once. The AbortSignal is respected throughout.
 */
export async function schedule(
  compiled: CompiledGraph,
  nodes: GraphNode[],
  edges: GraphEdge[],
  runId: string,
  signal: AbortSignal,
  opts: ScheduleOpts = {},
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
  // Pure data/config nodes are NOT executed — they only contribute their value
  // (via valueForSource) to downstream agents. loopcontrol is config-only too.
  const NON_EXEC = new Set(['idea', 'file', 'infocard', 'loopcontrol'])

  // --- "Wait for all inputs" gate ---------------------------------------------
  // A node with config.requireAllInputs only runs if EVERY upstream super
  // succeeded; otherwise it (and, by cascade, its dependents) is skipped instead
  // of running on partial input. okById tracks each super's success.
  const okById = new Map<string, boolean>()
  const superPreds = new Map<string, string[]>()
  for (const e of compiled.superEdges) {
    if (!superById.has(e.source) || !superById.has(e.target)) continue
    ;(superPreds.get(e.target) ?? superPreds.set(e.target, []).get(e.target)!).push(e.source)
  }
  const repNodeOf = (sup: Super): GraphNode | undefined =>
    sup.kind === 'loop'
      ? nodes.find((n) => n.id === sup.plan.backEdgeTargetId)
      : nodes.find((n) => n.id === sup.id)
  const gateBlocks = (sup: Super): boolean => {
    const n = repNodeOf(sup)
    if (!(n && (n.data.config as Record<string, unknown> | undefined)?.requireAllInputs)) return false
    return (superPreds.get(sup.id) ?? []).some((p) => okById.get(p) === false)
  }
  // Held (not run): waits for all inputs. Marked 'waiting', not 'skipped' — the
  // branch isn't abandoned; fix the upstream and re-run to let it proceed.
  const emitWaiting = (sup: Super): void => {
    const ids = sup.kind === 'loop' ? sup.plan.bodyOrder : [sup.id]
    for (const nid of ids) emitEvent(runId, { type: 'status', nodeId: nid, status: 'waiting' })
  }

  // Execute one super-node, recording its output for downstream nodes. Returns
  // whether it SUCCEEDED (drives the wait-for-all-inputs gate).
  const runSuper = async (sup: Super): Promise<boolean> => {
    if (sup.kind === 'loop') {
      const report = await runLoop(sup.plan, nodes, edges, runId, signal, undefined, Object.fromEntries(results))
      // Expose the loop's output under its verdict source (e.g. Temper) so
      // downstream nodes wired from it pick it up.
      if (report) results.set(sup.plan.verdictSourceId, report)
      return report != null
    }
    const node = nodes.find((n) => n.id === sup.id)
    if (!node || NON_EXEC.has(node.data.kind)) return true
    // The provider emits its own status/token/result events; we only need to
    // surface a thrown error (e.g. the needsAgent gate).
    try {
      const res = await runOneNode(node, nodes, edges, runId, signal, { results: Object.fromEntries(results) })
      if (res.result) results.set(node.id, res.result)
      return res.ok
    } catch (e) {
      emitEvent(runId, { type: 'error', nodeId: node.id, error: String((e as Error)?.message ?? e) })
      return false
    }
  }

  // A finished super unlocks its successors (decrement indegree, enqueue at 0).
  const advance = (id: string): void => {
    for (const m of adj.get(id) ?? []) {
      indeg.set(m, (indeg.get(m) ?? 0) - 1)
      if ((indeg.get(m) ?? 0) <= 0 && !done.has(m)) ready.push(m)
    }
  }

  if (opts.parallel) {
    const cap = Math.max(1, opts.concurrency ?? 3)
    // Mutex key per super = its working dir, so two supers that share a dir
    // (an explicit workingDir, or a loop body) never run concurrently.
    const lockKey = (sup: Super): string => {
      const repId = sup.kind === 'loop' ? sup.plan.backEdgeTargetId : sup.id
      const node = nodes.find((n) => n.id === repId)
      return node ? `wd:${effectiveWorkingDir(node, nodes, edges)}` : `id:${repId}`
    }
    const running = new Map<string, Promise<string>>()
    const lockedDirs = new Set<string>()
    while ((ready.length || running.size) && !signal.aborted) {
      // Fill open slots with ready supers whose working dir isn't busy.
      for (let i = 0; i < ready.length && running.size < cap; ) {
        const id = ready[i]
        const sup = superById.get(id)
        if (!sup || done.has(id)) {
          ready.splice(i, 1)
          continue
        }
        // Wait-for-all-inputs: skip (don't run) if an upstream super failed.
        if (gateBlocks(sup)) {
          ready.splice(i, 1)
          done.add(id)
          okById.set(id, false)
          emitWaiting(sup)
          advance(id)
          continue
        }
        const key = lockKey(sup)
        if (lockedDirs.has(key)) {
          i++ // dir busy → leave this one for a later round
          continue
        }
        ready.splice(i, 1)
        done.add(id)
        lockedDirs.add(key)
        running.set(
          id,
          runSuper(sup).then((ok) => {
            okById.set(id, ok)
            lockedDirs.delete(key)
            return id
          }),
        )
      }
      if (!running.size) break // nothing runnable right now (ready empty)
      const finishedId = await Promise.race(running.values())
      running.delete(finishedId)
      advance(finishedId)
    }
    // Let any still-running supers settle (e.g. on abort) so none leak.
    if (running.size) await Promise.allSettled(running.values())
  } else {
    while (ready.length) {
      if (signal.aborted) break
      const id = ready.shift()!
      if (done.has(id)) continue
      done.add(id)
      const sup = superById.get(id)
      if (!sup) continue
      // Wait-for-all-inputs: skip (don't run) if an upstream super failed.
      if (gateBlocks(sup)) {
        okById.set(id, false)
        emitWaiting(sup)
        advance(id)
        continue
      }
      okById.set(id, await runSuper(sup))
      advance(id)
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
