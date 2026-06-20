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
        verdict: {
          distribution: ev.distribution,
          allCorrect: ev.allCorrect,
          results: ev.results,
          protoDir: ev.protoDir,
        },
      })
      break
    case 'error':
      s.setRunState(ev.nodeId, { status: 'error', error: ev.error })
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
    // Stream ended or dropped; if the run wasn't marked done, surface it.
    if (useGraphStore.getState().currentRunId === runId) {
      useGraphStore.getState().setActiveEdges([])
    }
  }
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
