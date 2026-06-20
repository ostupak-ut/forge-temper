import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runLoop } from './loopDriver'
import type { LoopPlan } from './compile'
import type { GraphEdge, GraphNode, NodeVerdict, RunOneResult } from './runOneNode'
import { getBus, createBus, endBus } from '../run/runEvents'

/**
 * Unit tests for the loop driver. Run with: `npx tsx --test server/engine/loopDriver.test.ts`
 * (uses node:test — no extra dependency). Provider.run is stubbed via a fake
 * runOneNode injected through deps; verdicts are scripted per iteration.
 */

const forge: GraphNode = { id: 'forge-1', data: { kind: 'forge', label: 'Forge', config: {} } }
const temper: GraphNode = { id: 'temper-1', data: { kind: 'temper', label: 'Temper', config: {} } }
const nodes = [forge, temper]
const edges: GraphEdge[] = [
  { source: 'forge-1', target: 'temper-1', sourceHandle: 'out:paper', targetHandle: 'in:paper' },
  { source: 'temper-1', target: 'forge-1', sourceHandle: 'out:report', targetHandle: 'in:feedback', type: 'feedback', data: { loopBackEdge: true } },
]

function plan(mode: 'until-pass' | 'until-count', maxIterations: number): LoopPlan {
  return {
    id: 'loop-1',
    feedbackEdge: edges[1],
    config: { mode, maxIterations, approveEachIteration: false },
    bodyOrder: ['forge-1', 'temper-1'],
    backEdgeTargetId: 'forge-1',
    verdictSourceId: 'temper-1',
  }
}

const v = (allCorrect: boolean): NodeVerdict => ({
  distribution: { v: allCorrect ? 2 : 1, p: 0, h: allCorrect ? 0 : 1, c: 0 },
  allCorrect,
  results: 2,
  protoDir: 'papers/forge-1/proto',
})

/** Build a fake runOneNode that returns scripted verdicts for the temper node. */
function fakeRunner(temperVerdicts: (NodeVerdict | undefined)[]) {
  let temperCalls = 0
  const calls: string[] = []
  const fn = (async (node: GraphNode): Promise<RunOneResult> => {
    calls.push(node.id)
    if (node.id === 'temper-1') {
      const vd = temperVerdicts[Math.min(temperCalls, temperVerdicts.length - 1)]
      temperCalls++
      return { ok: true, result: 'report text', sessionId: 's-temper', verdict: vd }
    }
    return { ok: true, result: 'forged', sessionId: 's-forge' }
  }) as unknown as typeof import('./runOneNode').runOneNode
  return { fn, calls, temperCallCount: () => temperCalls }
}

function events(runId: string) {
  return getBus(runId)?.events ?? []
}

test('until-pass converges when temper reports all-correct', async () => {
  const runId = 'r-converge'
  createBus(runId)
  const { fn } = fakeRunner([v(false), v(true)])
  await runLoop(plan('until-pass', 5), nodes, edges, runId, new AbortController().signal, { runOneNode: fn })
  const done = events(runId).find((e) => e.type === 'loop-done')
  assert.ok(done && done.type === 'loop-done')
  assert.equal(done.converged, true)
  assert.equal(done.reason, 'converged')
  assert.equal(done.iterations, 2)
  endBus(runId)
})

test('hard cap stops at maxIterations even when never all-correct', async () => {
  const runId = 'r-cap'
  createBus(runId)
  const { fn } = fakeRunner([v(false)])
  await runLoop(plan('until-pass', 3), nodes, edges, runId, new AbortController().signal, { runOneNode: fn })
  const done = events(runId).find((e) => e.type === 'loop-done')
  assert.ok(done && done.type === 'loop-done')
  assert.equal(done.iterations, 3)
  assert.equal(done.reason, 'max-iterations')
  assert.equal(done.converged, false)
  endBus(runId)
})

test('missing verdict retries temper once then stops with no-verdict', async () => {
  const runId = 'r-noverdict'
  createBus(runId)
  // temper returns undefined verdict twice (first run + retry) → no-verdict.
  const r = fakeRunner([undefined, undefined])
  await runLoop(plan('until-pass', 5), nodes, edges, runId, new AbortController().signal, { runOneNode: r.fn })
  const done = events(runId).find((e) => e.type === 'loop-done')
  assert.ok(done && done.type === 'loop-done')
  assert.equal(done.reason, 'no-verdict')
  // forge once + temper twice (initial + retry) on the single iteration.
  assert.equal(r.temperCallCount(), 2)
  endBus(runId)
})

test('abort before the loop body stops immediately', async () => {
  const runId = 'r-abort'
  createBus(runId)
  const ac = new AbortController()
  ac.abort()
  const { fn, calls } = fakeRunner([v(false)])
  await runLoop(plan('until-pass', 5), nodes, edges, runId, ac.signal, { runOneNode: fn })
  assert.equal(calls.length, 0)
  const done = events(runId).find((e) => e.type === 'loop-done')
  assert.ok(done && done.type === 'loop-done')
  assert.equal(done.reason, 'aborted')
  endBus(runId)
})
