import type { RunEvent } from '@shared/contracts'
import { useGraphStore } from '@/store/graphStore'

let es: EventSource | null = null

function handle(ev: RunEvent) {
  const s = useGraphStore.getState()
  switch (ev.type) {
    case 'status':
      s.setRunState(ev.nodeId, { status: ev.status, ...(ev.iteration != null ? { iteration: ev.iteration } : {}) })
      break
    case 'token':
      s.appendTail(ev.nodeId, ev.text)
      break
    case 'tool':
      s.appendTail(ev.nodeId, `\n⟨${ev.tool}⟩ `)
      break
    case 'result':
      s.setRunState(ev.nodeId, {
        status: ev.ok ? 'done' : 'error',
        ...(ev.costUsd != null ? { costUsd: ev.costUsd } : {}),
        ...(ev.result != null ? { result: ev.result } : {}),
      })
      break
    case 'verdict':
      s.setRunState(ev.nodeId, {
        ...(ev.iteration != null ? { iteration: ev.iteration } : {}),
        verdict: {
          distribution: ev.distribution,
          allCorrect: ev.allCorrect,
          results: ev.results,
          protoDir: ev.protoDir,
        },
      })
      break
    case 'iteration':
      // The loop driver reports a completed iteration on the back-edge target
      // (Forge). Surface the iteration count + verdict so the FeedbackEdge label
      // and the node badge update live.
      s.setRunState(ev.nodeId, {
        iteration: ev.iteration,
        verdict: {
          distribution: ev.distribution,
          allCorrect: ev.allCorrect,
          results: ev.results,
          protoDir: ev.protoDir,
        },
      })
      break
    case 'loop-done':
      // Loop finished; nothing node-specific to update (the last 'iteration'
      // already carries the final verdict). run-done will clear active edges.
      break
    case 'error':
      if (ev.nodeId) s.setRunState(ev.nodeId, { status: 'error', error: ev.error })
      break
    case 'run-done':
      s.setActiveEdges([])
      s.setCurrentRunId(null)
      es?.close()
      es = null
      break
  }
}

/** Execute a single node via the backend and stream its events into the store. */
export async function runSingleNode(nodeId: string): Promise<void> {
  const st = useGraphStore.getState()
  st.resetRun()
  st.setRunState(nodeId, { status: 'queued' })
  const { nodes, edges } = st

  let runId: string | undefined
  try {
    const res = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'single', nodeId, graph: { nodes, edges } }),
    })
    const json = await res.json()
    runId = json.runId
    if (!runId) {
      st.setRunState(nodeId, { status: 'error', error: json.error ?? 'failed to start run' })
      return
    }
  } catch (e) {
    st.setRunState(nodeId, { status: 'error', error: String(e) })
    return
  }

  st.setCurrentRunId(runId)
  st.setActiveEdges(edges.filter((e) => e.source === nodeId).map((e) => e.id))

  subscribe(runId)
}

/** Open (or reopen) the SSE stream for a run and pipe events into the store. */
function subscribe(runId: string): void {
  es?.close()
  es = new EventSource(`/api/runs/${runId}/stream`)
  es.onmessage = (e) => {
    try {
      handle(JSON.parse(e.data) as RunEvent)
    } catch {
      /* ignore malformed */
    }
  }
  es.onerror = () => {
    // Stream ended or dropped without a run-done (e.g. server restart). Clear
    // the run so the Toolbar's Stop button doesn't get stuck pointing at a dead
    // run id.
    if (useGraphStore.getState().currentRunId === runId) {
      useGraphStore.getState().setActiveEdges([])
      useGraphStore.getState().setCurrentRunId(null)
      es?.close()
      es = null
    }
  }
}

/**
 * Execute the WHOLE graph (cycle-aware) via the backend and stream events. The
 * engine compiles the flat cyclic graph, runs nodes sequentially, and iterates
 * the Forge↔Temper cycle through the loop driver.
 */
export async function runGraph(): Promise<void> {
  const st = useGraphStore.getState()
  st.resetRun()
  const { nodes, edges } = st

  let runId: string | undefined
  try {
    const res = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'graph', graph: { nodes, edges } }),
    })
    const json = await res.json()
    runId = json.runId
    if (!runId) return
  } catch {
    return
  }

  st.setCurrentRunId(runId)
  st.setActiveEdges(edges.map((e) => e.id))

  subscribe(runId)
}

export async function stopCurrentRun(): Promise<void> {
  const runId = useGraphStore.getState().currentRunId
  if (!runId) return
  try {
    await fetch(`/api/runs/${runId}/stop`, { method: 'POST' })
  } catch {
    /* ignore */
  }
}
