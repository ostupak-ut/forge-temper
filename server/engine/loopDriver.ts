import { emitEvent } from '../run/runEvents'
import { runOneNode } from './runOneNode'
import type { GraphEdge, GraphNode, NodeVerdict } from './runOneNode'
import type { LoopPlan } from './compile'

/**
 * Drive one Forge↔Temper cycle (the loop super-node). Each iteration runs every
 * node in bodyOrder (Forge first … Temper last). The prior iteration's verdict
 * report is injected into the back-edge target's {{temper_report}}/{{feedback}}
 * vars. Sessions are threaded per node so context compounds across iterations.
 *
 * Stop conditions:
 *   - until-pass: stop when the verdict source is all-correct.
 *   - always: stop when maxIterations is reached (the hard cap).
 *   - a MISSING/invalid verdict counts as NOT correct → retry the verdict source
 *     ONCE, then stop with reason 'no-verdict'.
 * Emits an 'iteration' event per iteration and a final 'loop-done'.
 */

export interface RunLoopDeps {
  runOneNode: typeof runOneNode
}

const aborted = (signal: AbortSignal): boolean => signal.aborted

export async function runLoop(
  loop: LoopPlan,
  nodes: GraphNode[],
  edges: GraphEdge[],
  runId: string,
  signal: AbortSignal,
  deps: RunLoopDeps = { runOneNode },
  seedResults: Record<string, string> = {},
): Promise<string> {
  const max = loop.config.maxIterations
  const untilPass = loop.config.mode === 'until-pass'
  const bodyNodes = loop.bodyOrder
    .map((id) => nodes.find((n) => n.id === id))
    .filter((n): n is GraphNode => Boolean(n))

  // Body-node outputs (seeded with pre-loop results) so an agent inserted on the
  // cycle eats upstream + earlier-in-body outputs via its input ports.
  const results: Record<string, string> = { ...seedResults }
  const sessions = new Map<string, string>() // nodeId -> resumeSessionId
  let lastVerdict: NodeVerdict | undefined
  let lastReport = '' // verdict source's text/report, fed back into the target
  let converged = false
  let reason = 'max-iterations'
  let iterations = 0

  for (let iter = 1; iter <= max; iter++) {
    if (aborted(signal)) {
      reason = 'aborted'
      break
    }
    iterations = iter
    let iterVerdict: NodeVerdict | undefined

    for (const node of bodyNodes) {
      if (aborted(signal)) break
      // Inject the prior iteration's verdict report into the back-edge target.
      const vars: Record<string, string> =
        node.id === loop.backEdgeTargetId && lastReport
          ? { temper_report: lastReport, feedback: lastReport }
          : {}

      const res = await deps.runOneNode(node, nodes, edges, runId, signal, {
        vars,
        results,
        iteration: iter,
        loopId: loop.id,
        resumeSessionId: sessions.get(node.id),
      })
      if (res.sessionId) sessions.set(node.id, res.sessionId)
      if (res.result) results[node.id] = res.result

      // The verdict source (Temper) carries the convergence signal + report text.
      if (node.id === loop.verdictSourceId) {
        iterVerdict = res.verdict
        if (res.result) lastReport = res.result
      }
    }

    if (aborted(signal)) {
      reason = 'aborted'
      break
    }

    // until-pass only: a missing/invalid verdict counts as NOT correct → retry
    // the source once. (until-count ignores the verdict and just runs N times,
    // so custom-agent loops with no verdict iterate the full count.)
    if (untilPass && !iterVerdict) {
      const source = bodyNodes.find((n) => n.id === loop.verdictSourceId)
      if (source && !aborted(signal)) {
        const retry = await deps.runOneNode(source, nodes, edges, runId, signal, {
          vars: lastReport ? { temper_report: lastReport, feedback: lastReport } : {},
          results,
          iteration: iter,
          loopId: loop.id,
          resumeSessionId: sessions.get(source.id),
        })
        if (retry.sessionId) sessions.set(source.id, retry.sessionId)
        if (retry.result) lastReport = retry.result
        iterVerdict = retry.verdict
      }
    }

    lastVerdict = iterVerdict

    const dist = iterVerdict?.distribution ?? { v: 0, p: 0, h: 0, c: 0 }
    emitEvent(runId, {
      type: 'iteration',
      loopId: loop.id,
      nodeId: loop.backEdgeTargetId,
      iteration: iter,
      distribution: dist,
      results: iterVerdict?.results ?? 0,
      allCorrect: iterVerdict?.allCorrect ?? false,
      ...(iterVerdict?.protoDir ? { protoDir: iterVerdict.protoDir } : {}),
    })

    if (untilPass && !iterVerdict) {
      reason = 'no-verdict'
      break
    }
    if (untilPass && iterVerdict?.allCorrect) {
      converged = true
      reason = 'converged'
      break
    }
    if (iter >= max) {
      reason = 'max-iterations'
      break
    }
  }

  if (aborted(signal)) {
    reason = 'aborted'
    converged = false
  } else {
    // until-count is "converged" iff it ran the full count without abort.
    if (!converged && !untilPass && reason === 'max-iterations') converged = true
    // Treat a final all-correct verdict as converged regardless of mode.
    if (lastVerdict?.allCorrect) converged = true
  }

  emitEvent(runId, {
    type: 'loop-done',
    loopId: loop.id,
    converged,
    iterations,
    reason,
  })

  // The loop's "output" is the verdict source's final report — the scheduler
  // threads it into downstream nodes' {{vars}}.
  return lastReport
}
