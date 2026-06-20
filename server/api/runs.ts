import type { FastifyInstance } from 'fastify'
import type { RunEvent } from '@shared/contracts'
import { createBus, emitEvent, endBus, getBus } from '../run/runEvents'
import { runStore } from '../persistence/runStore'
import { runOneNode, runGraph } from '../engine'
import type { GraphEdge, GraphNode } from '../engine'

let seq = 0
const newRunId = () => `run-${Date.now().toString(36)}-${(++seq).toString(36)}`

export async function runRoutes(app: FastifyInstance) {
  app.post('/api/runs', async (req, reply) => {
    const body = req.body as {
      mode?: string
      nodeId?: string
      graph?: { nodes: GraphNode[]; edges?: GraphEdge[] }
    }
    const nodes = body?.graph?.nodes ?? []
    const edges = body?.graph?.edges ?? []

    // mode:'graph' — compile the flat cyclic graph and run it end-to-end
    // (loops iterate via the engine's loop driver).
    if (body.mode === 'graph') {
      const runId = newRunId()
      const bus = createBus(runId)
      runStore.createRun(runId, 'graph')
      let failed = false
      void runGraph({ nodes, edges }, runId, bus.ac.signal)
        .catch((e) => {
          failed = true
          emitEvent(runId, { type: 'error', nodeId: '', error: String((e as Error)?.message ?? e) })
        })
        .finally(() => {
          const status = failed ? 'error' : bus.ac.signal.aborted ? 'stopped' : 'done'
          runStore.finishRun(runId, status)
          emitEvent(runId, { type: 'run-done', status })
          endBus(runId)
        })
      return { runId }
    }

    // mode:'single' — run exactly one node.
    const node = nodes.find((n) => n.id === body.nodeId)
    if (!node) return reply.code(400).send({ error: 'node not found in graph' })

    const runId = newRunId()
    const bus = createBus(runId)
    runStore.createRun(runId, `single:${node.data.kind}`)

    void (async () => {
      try {
        await runOneNode(node, nodes, edges, runId, bus.ac.signal)
        runStore.finishRun(runId, bus.ac.signal.aborted ? 'stopped' : 'done')
        emitEvent(runId, { type: 'run-done', status: bus.ac.signal.aborted ? 'stopped' : 'done' })
      } catch (e) {
        runStore.finishRun(runId, 'error')
        emitEvent(runId, { type: 'error', nodeId: node.id, error: String((e as Error)?.message ?? e) })
        emitEvent(runId, { type: 'run-done', status: 'error' })
      } finally {
        endBus(runId)
      }
    })()

    return { runId }
  })

  app.post('/api/runs/:id/stop', async (req) => {
    const { id } = req.params as { id: string }
    getBus(id)?.ac.abort()
    return { ok: true }
  })

  app.get('/api/runs/:id', async (req) => {
    const { id } = req.params as { id: string }
    return runStore.getRun(id) ?? { error: 'not found' }
  })

  app.get('/api/runs/:id/stream', (req, reply) => {
    const { id } = req.params as { id: string }
    const bus = getBus(id)
    reply.hijack()
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    const send = (ev: RunEvent) => reply.raw.write(`data: ${JSON.stringify(ev)}\n\n`)

    if (!bus) {
      send({ type: 'run-done', status: 'error' })
      reply.raw.end()
      return
    }
    for (const ev of [...bus.events]) send(ev)
    if (bus.done) {
      reply.raw.end()
      return
    }
    const onEv = (ev: RunEvent) => send(ev)
    const onEnd = () => {
      cleanup()
      reply.raw.end()
    }
    const cleanup = () => {
      bus.emitter.off('ev', onEv)
      bus.emitter.off('end', onEnd)
    }
    bus.emitter.on('ev', onEv)
    bus.emitter.on('end', onEnd)
    req.raw.on('close', cleanup)
  })
}
